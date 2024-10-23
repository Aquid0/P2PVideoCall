let APP_ID = "20d653e785a845b0810418600fad7c42" // Should be hidden ideally

let token = null;
let uid = String(Math.floor(Math.random()*10000)) // Generate random UID

let client; 
let channel; // Users join 

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId) {
    window.location = 'lobby.html'
}

let localStream; // Local video and audio 
let remoteStream; // Other user video and audio
let peerConnection; 


const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.1.google.com:19302', 'stun:stun2.1.google.com:19302']
        }
    ]
}


let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    channel = client.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleUserJoined) // Any time a member joins, it calls this
    channel.on('MemberLeft', handleUserLeft)

    client.on('MessageFromPeer', handleMessageFromPeer)

    localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true}) // Requests permission
    document.getElementById('user-1').srcObject = localStream
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text)

    if (message.type === 'offer') {
        createAnswer(MemberId, message.offer)
    }

    if (message.type === 'answer') {
        addAnswer(message.answer)
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate)
        }
    }
}

let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
    document.getElementById('user-1').classList.remove('smallFrame')
}

let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId)
    createOffer(MemberId);
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)
    
    remoteStream = new MediaStream() // Making sure user 2 is ready
    document.getElementById('user-2').srcObject = remoteStream    
    document.getElementById('user-2').style.display = 'block' // Shows them as a block element when they join
    
    document.getElementById('user-1').classList.add('smallFrame')

    // Local Stream doesn't get created immediately when page refreshes, so value is null
    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false}) // Requests permission
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })


    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }


    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
        }
    }

}

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId)
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer', 'offer':offer})}, MemberId)
}

// Both users do the same thing - createPeerConnection
let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    // 2nd Peer that joined - receving end
    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
}


// Peer 1 sets Local Description and sends offer 
// Peer 2 when they get the offer, sets the remote and local description
// Peer 1 still needs to set their remote description, which will be their answer
let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async() => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,160,122)'
    } else {
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(169,169,169,.9)'
    }
}

let toggleMic = async() => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mute-btn').style.backgroundColor = 'rgb(255,160,122)'
    } else {
        audioTrack.enabled = true
        document.getElementById('mute-btn').style.backgroundColor = 'rgb(169, 169, 169)'
    }
}


window.addEventListener('beforeunload', leaveChannel) // Before website closes, user leaves channel

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mute-btn').addEventListener('click', toggleMic)


init() 
