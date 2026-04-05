from enum import Enum


class Environment(str, Enum):
    DEV = "dev"
    STAGING = "staging"
    PRODUCTION = "production"


class MetricType(str, Enum):
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    NETWORK = "network"
