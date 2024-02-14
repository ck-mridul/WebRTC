from django.urls import re_path
from . import consummers

websocket_urlpatterns = [
    re_path('',consummers.ChatConsummer.as_asgi())
]