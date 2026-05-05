from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

from backend.app.core.config import settings


def setup_telemetry() -> trace.Tracer:
    resource = Resource.create({"service.name": "aries-erp", "deployment.environment": settings.environment})
    provider = TracerProvider(resource=resource)

    if settings.environment != "test":
        exporter = OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)
    return trace.get_tracer("aries-erp")


tracer = setup_telemetry()
