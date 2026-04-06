import psutil
import docker
import json
import time
from flask import Flask, Response
from flask_cors import CORS
from whitenoise import WhiteNoise

app = Flask(__name__)
CORS(app)
app.wsgi_app = WhiteNoise(app.wsgi_app, root='dist/', index_file=True)

docker_client = docker.from_env()


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


def get_containers():
    containers = []
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

            cpu_percent = 0.0
            mem_percent = 0.0
            mem_gb = 0.0

            if c.status == 'running':
                try:
                    stats = c.stats(stream=False)
                    cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                                stats['precpu_stats']['cpu_usage']['total_usage']
                    system_delta = stats['cpu_stats'].get('system_cpu_usage', 0) - \
                                   stats['precpu_stats'].get('system_cpu_usage', 0)
                    num_cpus = len(stats['cpu_stats']['cpu_usage'].get('percpu_usage') or [1])
                    if system_delta > 0:
                        cpu_percent = round((cpu_delta / system_delta) * num_cpus * 100, 1)

                    mem_usage = stats['memory_stats'].get('usage', 0)
                    mem_limit = stats['memory_stats'].get('limit', 1)
                    mem_percent = round((mem_usage / mem_limit) * 100, 1)
                    mem_gb = round(mem_usage / (1024 ** 3), 2)
                except Exception:
                    pass

            containers.append({
                'name': c.name,
                'status': c.status,
                'cpu': cpu_percent,
                'mem_percent': mem_percent,
                'mem_gb': mem_gb,
                'ports': ports,
                'image': c.image.tags[0] if c.image.tags else 'unknown',
            })

        containers.sort(key=lambda x: x['name'].lower())
    except Exception as e:
        print(f"Docker error: {e}")

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


@app.route('/plasmic-host')
def plasmic_host():
    return app.send_static_file('index.html')


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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
