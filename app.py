import threading
import psutil
import docker
import json
import time
from flask import Flask, Response
from flask_cors import CORS
from whitenoise import WhiteNoise

app = Flask(__name__, static_folder='dist', static_url_path='')
CORS(app)
app.wsgi_app = WhiteNoise(app.wsgi_app, root='dist/', index_file=True)

docker_client = docker.from_env()

# ✅ Shared cache — background threads write here, stream reads from here
container_stats_cache: dict = {}
cache_lock = threading.Lock()


def get_cpu_temp():
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return None
        for name in ['coretemp', 'cpu_thermal', 'k10temp', 'acpitz']:
            if name in temps and temps[name]:
                return round(temps[name][0].current, 1)
        first = next(iter(temps.values()))
        if first:
            return round(first[0].current, 1)
    except Exception:
        pass
    return None


def watch_container(c):
    """Runs forever in its own thread, continuously updating the cache for one container."""
    name = c.name
    while True:
        try:
            for stat in c.stats(stream=True, decode=True):
                cpu_percent = 0.0
                try:
                    cpu_delta = stat['cpu_stats']['cpu_usage']['total_usage'] - \
                                stat['precpu_stats']['cpu_usage']['total_usage']
                    system_delta = stat['cpu_stats'].get('system_cpu_usage', 0) - \
                                   stat['precpu_stats'].get('system_cpu_usage', 0)
                    num_cpus = len(stat['cpu_stats']['cpu_usage'].get('percpu_usage') or [1])
                    if system_delta > 0:
                        cpu_percent = round((cpu_delta / system_delta) * num_cpus * 100, 1)
                except Exception:
                    pass

                mem_percent = 0.0
                mem_gb = 0.0
                try:
                    mem_usage = stat['memory_stats'].get('usage', 0)
                    mem_limit = stat['memory_stats'].get('limit', 1)
                    mem_percent = round((mem_usage / mem_limit) * 100, 1)
                    mem_gb = round(mem_usage / (1024 ** 3), 2)
                except Exception:
                    pass

                with cache_lock:
                    if name in container_stats_cache:
                        container_stats_cache[name]['cpu'] = cpu_percent
                        container_stats_cache[name]['mem_percent'] = mem_percent
                        container_stats_cache[name]['mem_gb'] = mem_gb

        except Exception:
            # Container stopped or errored — wait a bit then retry
            time.sleep(2)
            try:
                # Refresh container object in case it restarted
                c = docker_client.containers.get(name)
            except Exception:
                break  # Container is gone, stop watching


def start_watching_containers():
    """Called once at startup — spawns a watcher thread per running container."""
    try:
        for c in docker_client.containers.list(all=True):
            ports = []
            if c.ports:
                for container_port, bindings in c.ports.items():
                    proto = container_port.split('/')[1] if '/' in container_port else 'tcp'
                    cport = container_port.split('/')[0]
                    if bindings:
                        for b in bindings:
                            host_port = b.get('HostPort', cport)
                            ports.append(f"{host_port}/{proto}")
                    else:
                        ports.append(f"{cport}/{proto}")

            with cache_lock:
                container_stats_cache[c.name] = {
                    'name': c.name,
                    'status': c.status,
                    'cpu': 0.0,
                    'mem_percent': 0.0,
                    'mem_gb': 0.0,
                    'ports': ports,
                    'image': c.image.tags[0] if c.image.tags else 'unknown',
                }

            if c.status == 'running':
                t = threading.Thread(target=watch_container, args=(c,), daemon=True)
                t.start()

    except Exception as e:
        print(f"Error starting watchers: {e}")


def refresh_container_list():
    """Runs in background — detects new/removed containers and updates cache."""
    while True:
        time.sleep(5)
        try:
            current = {c.name: c for c in docker_client.containers.list(all=True)}

            with cache_lock:
                cached_names = set(container_stats_cache.keys())

            # Add new containers
            for name, c in current.items():
                if name not in cached_names:
                    ports = []
                    if c.ports:
                        for container_port, bindings in c.ports.items():
                            proto = container_port.split('/')[1] if '/' in container_port else 'tcp'
                            cport = container_port.split('/')[0]
                            if bindings:
                                for b in bindings:
                                    host_port = b.get('HostPort', cport)
                                    ports.append(f"{host_port}/{proto}")
                            else:
                                ports.append(f"{cport}/{proto}")

                    with cache_lock:
                        container_stats_cache[name] = {
                            'name': c.name,
                            'status': c.status,
                            'cpu': 0.0,
                            'mem_percent': 0.0,
                            'mem_gb': 0.0,
                            'ports': ports,
                            'image': c.image.tags[0] if c.image.tags else 'unknown',
                        }

                    if c.status == 'running':
                        t = threading.Thread(target=watch_container, args=(c,), daemon=True)
                        t.start()

            # Remove deleted containers
            for name in cached_names:
                if name not in current:
                    with cache_lock:
                        del container_stats_cache[name]

            # Update statuses
            for name, c in current.items():
                with cache_lock:
                    if name in container_stats_cache:
                        container_stats_cache[name]['status'] = c.status

        except Exception as e:
            print(f"Refresh error: {e}")


def get_containers():
    with cache_lock:
        containers = list(container_stats_cache.values())
    containers.sort(key=lambda x: x['name'].lower())
    return containers


def get_stats():
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    return {
        'cpu': {
            'percent': psutil.cpu_percent(interval=None),
            'temp': get_cpu_temp(),
        },
        'mem': {
            'percent': round(mem.percent, 1),
            'used': round(mem.used / (1024 ** 3), 1),
            'total': round(mem.total / (1024 ** 3), 1),
        },
        'disk': {
            'percent': round(disk.percent, 1),
            'used': round(disk.used / (1024 ** 3), 1),
            'total': round(disk.total / (1024 ** 3), 1),
        },
        'containers': get_containers(),
    }


@app.route('/stream')
def stream():
    def generate():
        psutil.cpu_percent(interval=None)
        while True:
            try:
                data = get_stats()
                yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            time.sleep(1)

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        }
    )


@app.route('/health')
def health():
    return {'status': 'ok'}


@app.errorhandler(404)
def not_found(e):
    return app.send_static_file('index.html')


# ✅ Start background threads before first request
start_watching_containers()
threading.Thread(target=refresh_container_list, daemon=True).start()

if __name__ == '__main__':
    app.run(host='***.0.0', port=80)
