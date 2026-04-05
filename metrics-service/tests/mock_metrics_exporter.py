import time
import random
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

def simulate_metrics():
    """Simulate some metrics for a test pod."""
    ns = "test-ns"
    pod = "test-pod"
    container = "test-container"
    
    # Initialize values
    RUNNING.labels(namespace=ns, pod=pod, container=container).set(1)
    
    while True:
        # Simulate CPU (incrementing counter)
        current_cpu = random.uniform(0.1, 0.5)
        CPU_USAGE.labels(namespace=ns, pod=pod, container=container).inc(current_cpu)
        
        # Simulate Memory (fluctuating gauge)
        current_mem = random.uniform(200_000_000, 300_000_000) # ~250MB
        MEM_USAGE.labels(namespace=ns, pod=pod, container=container).set(current_mem)
        
        # Simulate Disk I/O
        FS_READS.labels(namespace=ns, pod=pod, container=container).inc(random.randint(1000, 5000))
        FS_WRITES.labels(namespace=ns, pod=pod, container=container).inc(random.randint(500, 2000))
        
        # Simulate Network I/O
        NET_RX.labels(namespace=ns, pod=pod, interface="eth0").inc(random.randint(10000, 50000))
        NET_TX.labels(namespace=ns, pod=pod, interface="eth0").inc(random.randint(5000, 20000))
        
        # Randomly simulate a restart every ~100 iterations
        if random.random() < 0.01:
            RESTARTS.labels(namespace=ns, pod=pod, container=container).inc(1)
            
        time.sleep(5)

if __name__ == '__main__':
    print("Starting mock metrics exporter on port 8000...")
    start_http_server(8000)
    simulate_metrics()
