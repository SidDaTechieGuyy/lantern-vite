import json
import threading
import time

import docker
import psutil
from flask import Flask, Response
from whitenoise import WhiteNoise


STATS_INTERVAL_SECONDS = 1
CONTAINER_REFRESH_SECONDS = 5
BYTES_IN_GIB = 1024 ** 3

app = Flask(__name__, static_folder="dist", static_url_path="")
app.wsgi_app = WhiteNoise(app.wsgi_app, root="dist/", index_file=True)


def create_docker_client():
    try:
        return docker.from_env()
    except Exception as exc:
        print(f"Docker unavailable: {exc}", flush=True)
        return None


docker_client = create_docker_client()
container_stats_cache: dict[str, dict] = {}
cache_lock = threading.Lock()


def get_cpu_temp():
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return None
        for name in ("coretemp", "cpu_thermal", "k10temp", "acpitz"):
            if name in temps and temps[name]:
                return round(temps[name][0].current, 1)
        first = next(iter(temps.values()))
        if first:
            return round(first[0].current, 1)
    except Exception:
        pass
    return None


def parse_ports(container) -> list[str]:
    seen = set()
    ports = []
    raw_ports = container.attrs.get("NetworkSettings", {}).get("Ports") or {}

    for container_port, bindings in raw_ports.items():
        container_value, _, protocol = container_port.partition("/")
        protocol = protocol or "tcp"

        if bindings:
            for binding in bindings:
                host_port = binding.get("HostPort") or container_value
                key = f"{host_port}/{protocol}"
                if key in seen:
                    continue
                seen.add(key)
                ports.append(key)
        else:
            key = f"{container_value}/{protocol}"
            if key in seen:
                continue
            seen.add(key)
            ports.append(key)

    return ports


def image_name(container) -> str:
    tags = getattr(container.image, "tags", None) or []
    return tags[0] if tags else "unknown"


def calculate_cpu_percent(stats: dict) -> float:
    try:
        cpu_usage = stats["cpu_stats"]["cpu_usage"]
        prev_cpu_usage = stats["precpu_stats"]["cpu_usage"]
        cpu_delta = cpu_usage["total_usage"] - prev_cpu_usage["total_usage"]
        system_delta = stats["cpu_stats"].get("system_cpu_usage", 0) - stats[
            "precpu_stats"
        ].get("system_cpu_usage", 0)
        online_cpus = stats["cpu_stats"].get("online_cpus") or len(
            cpu_usage.get("percpu_usage") or [1]
        )
        if cpu_delta > 0 and system_delta > 0:
            return round((cpu_delta / system_delta) * online_cpus * 100, 1)
    except Exception:
        pass
    return 0.0


def calculate_memory(stats: dict) -> tuple[float, float]:
    try:
        memory_stats = stats.get("memory_stats", {})
        usage = memory_stats.get("usage", 0)
        cache = memory_stats.get("stats", {}).get("cache", 0)
        limit = memory_stats.get("limit") or 1
        adjusted_usage = max(usage - cache, 0)
        return (
            round((adjusted_usage / limit) * 100, 1),
            round(adjusted_usage / BYTES_IN_GIB, 2),
        )
    except Exception:
        return 0.0, 0.0


def sample_container(container) -> dict:
    previous = container_stats_cache.get(container.name, {})
    data = {
        "name": container.name,
        "status": container.status,
        "cpu": previous.get("cpu", 0.0),
        "mem_percent": previous.get("mem_percent", 0.0),
        "mem_gb": previous.get("mem_gb", 0.0),
        "ports": parse_ports(container),
        "image": image_name(container),
    }

    if container.status != "running":
        data["cpu"] = 0.0
        data["mem_percent"] = 0.0
        data["mem_gb"] = 0.0
        return data

    try:
        stats = container.stats(stream=False, decode=True)
        data["cpu"] = calculate_cpu_percent(stats)
        data["mem_percent"], data["mem_gb"] = calculate_memory(stats)
    except Exception as exc:
        data["error"] = str(exc)

    return data


def poll_containers():
    if docker_client is None:
        return

    while True:
        try:
            containers = docker_client.containers.list(all=True)
            next_cache = {container.name: sample_container(container) for container in containers}
            with cache_lock:
                container_stats_cache.clear()
                container_stats_cache.update(next_cache)
        except Exception as exc:
            print(f"Container poll error: {exc}", flush=True)
        time.sleep(CONTAINER_REFRESH_SECONDS)


def get_containers():
    with cache_lock:
        containers = list(container_stats_cache.values())
    containers.sort(key=lambda item: item["name"].lower())
    return containers


def get_stats():
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "cpu": {
            "percent": psutil.cpu_percent(interval=None),
            "temp": get_cpu_temp(),
        },
        "mem": {
            "percent": round(mem.percent, 1),
            "used": round(mem.used / BYTES_IN_GIB, 1),
            "total": round(mem.total / BYTES_IN_GIB, 1),
        },
        "disk": {
            "percent": round(disk.percent, 1),
            "used": round(disk.used / BYTES_IN_GIB, 1),
            "total": round(disk.total / BYTES_IN_GIB, 1),
        },
        "containers": get_containers(),
    }


@app.route("/stream")
def stream():
    def generate():
        psutil.cpu_percent(interval=None)
        while True:
            try:
                yield f"data: {json.dumps(get_stats())}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            time.sleep(STATS_INTERVAL_SECONDS)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.route("/health")
def health():
    return {"status": "ok", "docker": docker_client is not None}


@app.errorhandler(404)
def not_found(_error):
    return app.send_static_file("index.html")


threading.Thread(target=poll_containers, daemon=True).start()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
