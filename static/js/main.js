console.log('in main.js')

var mapPeers = {};

var configuration = {
    iceServers: [
        {
            urls:['stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302']
        } 
    ],
};


 
var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');

var  username;
var webSocket;

function webSocketOnMessage(event){
    var parsendData = JSON.parse(event.data);

    var peerUsername = parsendData['peer']
    var action = parsendData['action']

    if(username == peerUsername){
        return;
    }

    var receiver_channel_name = parsendData['message']['receiver_channel_name'];
    if (action == 'new-peer'){
        createOffer(peerUsername,receiver_channel_name);
        return;
    }

    if(action == 'new-offer'){
        var offer = parsendData['message']['sdp'];
        createAnswerer(offer, peerUsername, receiver_channel_name);

        return;
    }
    if(action == 'new-answer'){
        var answer = parsendData['message']['sdp'];
        var peer = mapPeers[peerUsername][0];

        peer.setRemoteDescription(answer);

        return;
    }
}

btnJoin.addEventListener('click',()=>{
    username = usernameInput.value;
    
    if(username == ''){
        return;
    }

    usernameInput.value = '';
    usernameInput.disabled = true;
    usernameInput.style.visibility = 'hidden';

    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';
    
    var labelUsername = document.querySelector('#label-username');
    labelUsername.innerHTML = username;

    var loc = window.location;
    var wsStart = 'ws://';

    if(loc.protocol == 'https:'){
        wsStart = 'wss://';
    }

    var endPoint = wsStart + loc.host + loc.pathname;

    webSocket = new WebSocket(endPoint);

    webSocket.addEventListener('open',(e) =>{
        console.log('conected');
        sendSignal('new-peer',{});
    })
    webSocket.addEventListener('message',webSocketOnMessage)
    webSocket.addEventListener('close',(e) =>{
        console.log('closed')
    })
    webSocket.addEventListener('error',(e) =>{
        console.log('error')
    })
});


var localStream = new MediaStream();
const constraints = {
    'video':true,
    'audio':true
};

const localVideo = document.querySelector('#local-video');

const btnToggleAudio = document.querySelector('#btn-toggle-audio');
const btnToggleVideo = document.querySelector('#btn-toggle-video');


var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream =>{
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        var audioTracks = stream.getAudioTracks()
        var videoTracks = stream.getVideoTracks()

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', () =>{
            audioTracks[0].enabled = !audioTracks[0].enabled;

            if(audioTracks[0].enabled){
                btnToggleAudio.innerHTML = 'Audio mute';
                return;
            }
            btnToggleAudio.innerHTML = 'Audio unmute'
        })

        btnToggleVideo.addEventListener('click', () =>{
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if(videoTracks[0].enabled){
                btnToggleVideo.innerHTML = 'Video off';
                return;
            }
            btnToggleVideo.innerHTML = 'Video on'
        })
    })
    .catch(error =>{
        console.log('Error accessing media devices',error);
    });

var btnSendMsg = document.querySelector('#btn-send-msg');
var messageList = document.querySelector('#message-list');
var messageInput = document.querySelector('#msg');

btnSendMsg.addEventListener('click',sendMsgOnClick)

function sendMsgOnClick() {
    var message = messageInput.value
    var li = document.createElement('li');
    li.appendChild(document.createTextNode('Me :'+ message));
    messageList.appendChild(li);
    
    var dataChannels  = getDataChannels();
    message = username + ': ' + message;

    for(index in dataChannels){
        dataChannels[index].send(message)
    }
}


var jsonStr = JSON.stringify({
    'peer': username,
    'action':'new-peer',
    'message':{

    },
});



function sendSignal(action,message){
    var jsonStr = JSON.stringify({
        'peer': username,
        'action':action,
        'message':message,
    });
    webSocket.send(jsonStr);
}

function createOffer(peerUsername,receiver_channel_name){
    var peer = new RTCPeerConnection(configuration);

    addLocalTracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open',()=>{
        console.log('connection opened')
    })
    dc.addEventListener('message',dcOnMessage)

    var remoteViedo = createVideo(peerUsername);
    setOnTrack(peer, remoteViedo)

    mapPeers[peerUsername] = [peer, dc];

    peer.addEventListener('iceconnectionstatechange',()=>{
        var iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState === "failed" || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername];
            if(iceConnectionState != 'closed'){
                peer.close();
            }
            removeVideo(remoteViedo);
        }
    });

    peer.addEventListener('icecandidate',(event)=>{
        if(event.candidate){
            console.log('New ice candidate :',JSON.stringify(peer.localDescription))
            return;
        }

        sendSignal('new-offer',{
            'sdp':peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        })
    })

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(()=>{
            console.log('Local description set successfully.')
        })
}

function createAnswerer(offer,peerUsername, receiver_channel_name){
    var peer = new RTCPeerConnection(configuration);

    addLocalTracks(peer);

    var remoteViedo = createVideo(peerUsername);
    setOnTrack(peer, remoteViedo)

    peer.addEventListener('datachannel', e =>{
        peer.dc = e.channel;
        peer.dc.addEventListener('open',()=>{
            console.log('answerer');
        })
        peer.dc.addEventListener('message',dcOnMessage)
        
        mapPeers[peerUsername] = [peer, peer.dc];
    })

    peer.addEventListener('iceconnectionstatechange',()=>{
        var iceConnectionState = peer.iceConnectionState;

        if(iceConnectionState === "failed" || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername];
            if(iceConnectionState != 'closed'){
                peer.close();
            }
            removeVideo(remoteViedo);
        }
    });

    peer.addEventListener('icecandidate',(event)=>{
        if(event.candidate){
            console.log('New ice candidate :',JSON.stringify(peer.localDescription))
            return;
        }

        sendSignal('new-answer',{
            'sdp':peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        })
    })

    peer.setRemoteDescription(offer)
        .then(()=>{
            console.log('Remote discription set successfully for %s.',peerUsername);
            return peer.createAnswer();
        })
        .then(a =>{
            console.log('ans created');
            peer.setLocalDescription(a);
        })

}

function addLocalTracks(peer){
    localStream.getTracks().forEach(track =>{
        peer.addTrack(track, localStream);
    });
    return;
}

function dcOnMessage(event){
    var message = event.data;

    var li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);
}

function createVideo(peerUsername){
    var videoContainer = document.querySelector('#video-container');
    var remoteViedo = document.createElement('video');
    remoteViedo.id = peerUsername + 'video';
    remoteViedo.autoplay = true;
    remoteViedo.playsInline = true;

    var videoWrapper = document.createElement('div');
    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteViedo);
    return remoteViedo;

}

function setOnTrack(peer, remoteViedo){
    var remoteSream = new MediaStream();
    remoteViedo.srcObject = remoteSream;

    peer.addEventListener('track', async (event)=>{
        remoteSream.addTrack(event.track, remoteSream);
    });
}

function removeVideo(video){
    var videoWrapper = video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper);
}


function getDataChannels(){
    var dataChannels = [];

    for(peerUsername in mapPeers){
        var dataChannel = mapPeers[peerUsername][1];

        dataChannels.push(dataChannel);
    }

    return dataChannels;
}