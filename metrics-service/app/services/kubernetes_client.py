"""
Kubernetes Client Configuration
================================
Handles authentication with the Kubernetes cluster.
Automatically falls back from In-Cluster (Production) to Local Kubeconfig (Dev).
"""

import logging
from typing import Optional

from kubernetes import client, config
from kubernetes.client.rest import ApiException

logger = logging.getLogger(__name__)

class K8sClient:
    """
    Singleton wrapper for the Kubernetes CoreV1Api.
    """
    _instance: Optional[client.CoreV1Api] = None
    _initialized = False

    @classmethod
    def get_instance(cls) -> client.CoreV1Api:
        if not cls._initialized:
            try:
                # Attempt to load In-Cluster config first (Production)
                config.load_incluster_config()
                logger.info("K8s: Loaded In-Cluster configuration.")
            except config.ConfigException:
                # Fallback to local Kubeconfig (Development)
                config.load_kube_config()
                logger.info("K8s: Loaded local Kubeconfig.")
            
            cls._instance = client.CoreV1Api()
            cls._initialized = True
            
        if cls._instance is None:
            raise RuntimeError("Failed to initialize Kubernetes client.")
            
        return cls._instance
