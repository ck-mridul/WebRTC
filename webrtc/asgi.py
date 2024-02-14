from channels.routing import ProtocolTypeRouter, URLRouter
import os
from django.core.asgi import get_asgi_application
from channels.auth import AuthMiddleware
import chat.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'webrtc.settings')

application = get_asgi_application()

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(chat.routing.websocket_urlpatterns)
    
})
