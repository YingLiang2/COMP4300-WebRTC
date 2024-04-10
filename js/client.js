
//Getting our buttons, so we can add events to them later.
const startLocalStreamButton = document.getElementById('startLocalStreamButton');
const startRemoteConnectionButton = document.getElementById('startRemoteConnectionButton')
const endStreamButton = document.getElementById('endStreamButton')

//These are the video players our on HTML page.
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

var localStreamStarted = false;
var isInCallAlready = false;

var localStream;
var peerConnection;

//We make a new socket which is how we have bidirectional communication with our server.
var socket = io();

socket.on('receiveMsg', (message) => {

    //If you haven't started your local stream (aka getting your local video and audio up)
    if (!localStreamStarted) {
        console.log("Your local stream has not started, therefore you cannot accept any incoming streams.");
        return;
    }

    if (message.type === "new_peer") {
        // Another peer is ready and has begun the connection process
        console.log("Another peer is ready and begun the connection process.")

    } else if (message.type === "offer") {

        if (isInCallAlready) {
            console.log("You are already in a call, cannot receieve new call.")
        } else {
            
            console.log(message)

            createNewPeerConnection();

            peerConnection.setRemoteDescription(message.offer).then(() => {
                peerConnection.createAnswer().then((newAnswer) => {
                    socket.emit('message', { 
                        type: 'answer', answer: newAnswer
                    });
                    peerConnection.setLocalDescription(newAnswer).then(()=>{
                        console.log("Accepted new offer, sent answer back")
                        console.log(peerConnection.connectionState)
                    });
                });
                isInCallAlready = true
            });
        }

    } else if (message.type === "candidate") {

        console.log(message)

        var newCandidate = new RTCIceCandidate({
            candidate: message.candidate,
            sdpMid: message.sdpMid,
            sdpMLineIndex: message.sdpMLineIndex
        })

        if (newCandidate) {
            
            peerConnection.addIceCandidate(newCandidate).then(() => {
                console.log("Successfully added new ICE Candidate"); 
            }) 
        }

        

    } else if (message.type === "answer") {
        peerConnection.setRemoteDescription(message.answer).then(() => {
            console.log("Succeesfully set remote description")
        })
    } else if (message.type === "end-stream") {
        closeAllVideoAndAudio()
    }

    
});

//This function is grabbing the camera and audio devices and starting the local stream.
async function startWebcamAndMic() {

    //The browser will ask for permissions which is why it is an await function. 
    //If you do not give the browswer permission to access your webcam and mic then the chat application will not work.
    const constraints = window.constraints = {
        audio: true,
        video: true
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // If the local stream exists, then we want to set it.
    if (localStream) {
        localVideo.srcObject = localStream;
        localStreamStarted = true;
        startRemoteConnectionButton.disabled = false;
        startLocalStreamButton.disabled = true;
    } else {
        console.log("There has been a problem with starting the local stream")
    }
}

async function startRemoteConnection() {

    //If you haven't started your local stream (aka getting your local video and audio up)
    if (!localStreamStarted) {
        console.log("Your local stream has not started, therefore you cannot accept any incoming messages or streams.");
    } else {
        socket.emit('message', { type: 'new_peer' });
        startNewCall()
    }
}

function createNewPeerConnection() {

    peerConnection = new RTCPeerConnection();

    //Grabbing ICE candidates
    peerConnection.onicecandidate = event => {

        //Because there will be so many ICE candidates, sometimes they will be null if we hit a ICE server 
        // and get back soemthing null, we do not want to pass it forward.

        if (event.candidate) {
            var message = {
                type: "candidate",
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex
            }
            socket.emit('message', message);
        }
    };

     //Adding video and audio tracks to our Peer Connection object so we can create an offer (local SDP)
     localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    //Here we are accepting new tracks from incoming streams
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    }

    peerConnection.onconnectionstatechange = (event) => {

        //Once we are connected to the other client, we want to disable some buttons.
        if (peerConnection.connectionState === "connected") {
            startLocalStreamButton.disabled = true;
            startRemoteConnectionButton.disabled = true;
            endStreamButton.disabled = false;
        }

    }

}

async function startNewCall() {

    createNewPeerConnection();

    const offer = await peerConnection.createOffer();

    socket.emit('message', {
        type: 'offer', offer:offer
    });
    await peerConnection.setLocalDescription(offer);
}

async function closeAllVideoAndAudio() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    isInCallAlready = false;
    localStreamStarted = false;
    startRemoteConnectionButton.disabled = true;
    startLocalStreamButton.disabled = false;
    endStreamButton.disabled = true;
}

async function endStream() {

    closeAllVideoAndAudio()

    //Send a message to the other client to end their stream as well
    socket.emit("message", {
        type: "end-stream"
    })
}

//These are adding click events to the our buttons. So when we click our buttons, they will invoke events.
startLocalStreamButton.addEventListener("click", startWebcamAndMic);
startRemoteConnectionButton.addEventListener("click", startRemoteConnection);
endStreamButton.addEventListener("click", endStream);
