import time
import random
import os
from prometheus_client import start_http_server, Gauge, Counter

# Define metrics following cAdvisor/Kubelet naming conventions
CPU_USAGE = Gauge('container_cpu_usage_seconds_total', 'Cumulative CPU usage', ['namespace', 'pod', 'container'])
MEM_USAGE = Gauge('container_memory_working_set_bytes', 'Current memory working set', ['namespace', 'pod', 'container'])
FS_READS = Counter('container_fs_reads_bytes_total', 'Cumulative count of bytes read', ['namespace', 'pod', 'container'])
FS_WRITES = Counter('container_fs_writes_bytes_total', 'Cumulative count of bytes written', ['namespace', 'pod', 'container'])
NET_RX = Counter('container_network_receive_bytes_total', 'Cumulative count of bytes received', ['namespace', 'pod', 'interface'])
NET_TX = Counter('container_network_transmit_bytes_total', 'Cumulative count of bytes transmitted', ['namespace', 'pod', 'interface'])

# Kube-state-metrics style
RESTARTS = Counter('kube_pod_container_status_restarts_total', 'The number of container restarts', ['namespace', 'pod', 'container'])
RUNNING = Gauge('kube_pod_container_status_running', 'Describe whether the container is running', ['namespace', 'pod', 'container'])

STATE_FILE = "/tmp/mock_exporter_restarts.txt"

def get_persisted_restarts():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return int(f.read().strip())
    return 0

def save_restarts(count):
    with open(STATE_FILE, "w") as f:
        f.write(str(count))

import math

def simulate_metrics():
    """Simulate realistic telemetry with sine waves and noise."""
    ns = "test-ns"
    pod = "test-pod"
    container = "test-container"
    
    # Initialize values
    RUNNING.labels(namespace=ns, pod=pod, container=container).set(1)
    
    # Handle persistent restarts: increment on startup
    current_restarts = get_persisted_restarts() + 1
    save_restarts(current_restarts)
    RESTARTS.labels(namespace=ns, pod=pod, container=container).inc(current_restarts)
    
    print(f"Pod {pod} started. Total restarts: {current_restarts}")
    
    start_time = time.time()
    
    while True:
        elapsed = time.time() - start_time
        
        # 1. CPU Simulation (Trend + Oscillation)
        # Low frequency drift (30 min) + High frequency jitter
        cpu_trend = 0.3 + 0.1 * math.sin(elapsed / 1800) 
        cpu_jitter = random.uniform(-0.05, 0.05)
        CPU_USAGE.labels(namespace=ns, pod=pod, container=container).inc(max(0.01, cpu_trend + cpu_jitter))
        
        # 2. Memory Simulation (Slow Drift)
        # Baseline 250MB + 40MB drift over 10 mins
        mem_base = 250_000_000
        mem_drift = 40_000_000 * math.sin(elapsed / 600)
        mem_noise = random.uniform(-5_000_000, 5_000_000)
        MEM_USAGE.labels(namespace=ns, pod=pod, container=container).set(mem_base + mem_drift + mem_noise)
        
        # 3. Disk & Network
        FS_READS.labels(namespace=ns, pod=pod, container=container).inc(random.randint(1000, 5000))
        FS_WRITES.labels(namespace=ns, pod=pod, container=container).inc(random.randint(500, 2000))
        NET_RX.labels(namespace=ns, pod=pod, interface="eth0").inc(random.randint(10000, 50000))
        NET_TX.labels(namespace=ns, pod=pod, interface="eth0").inc(random.randint(5000, 20000))
        
        time.sleep(2) # Faster updates for smoother charts

if __name__ == '__main__':
    print("Starting mock metrics exporter on port 8000...")
    start_http_server(8000)
    simulate_metrics()
