from channels.generic.websocket import AsyncWebsocketConsumer
import json

class ChatConsummer(AsyncWebsocketConsumer):
    async def connect(self):
        
        self.room_group_name = 'test_room'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
    
    
    async def disconnect(self, code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        print('disconnected')
    
    
    async def receive(self, text_data):
        recevie_dict = json.loads(text_data)
        message = recevie_dict['message']
        action = recevie_dict['action']
        
        if action == 'new-offer' or action == 'new-answer':
            receiver_channel_name = recevie_dict['message']['receiver_channel_name']
            print('channel_name :',receiver_channel_name)
            recevie_dict['message']['receiver_channel_name'] = self.channel_name

            
            await self.channel_layer.send(
                receiver_channel_name,{
                    'type': 'send.sdp',
                    'message': message,
                    'recevie_dict':recevie_dict
                }
            )
            
            return
        
        recevie_dict['message']['receiver_channel_name'] = self.channel_name
        
        await self.channel_layer.group_send(
            self.room_group_name,{
                'type': 'send.sdp',
                'message': message,
                'recevie_dict':recevie_dict
            }
        )
        
    
    async def send_sdp(self,event):
        recevie_dict = event['recevie_dict']
        
        await self.send(text_data=json.dumps(recevie_dict))