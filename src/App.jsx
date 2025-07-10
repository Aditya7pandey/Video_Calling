// client/src/App.jsx

import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_SERVER_URL);

function App() {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const [roomId, setRoomId] = useState("");
    const [joined, setJoined] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const peerConnection = useRef(null);

    useEffect(() => {
        // Attach local stream to video element after rendering
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        socket.on("user-joined", async (userId) => {
            console.log("User joined, initiating call:", userId);
            await callUser(userId);
        });

        socket.on("incoming-call", async ({ from, offer }) => {
            console.log("Incoming call from:", from);
            await answerCall(from, offer);
        });

        socket.on("call-accepted", async ({ from, answer }) => {
            console.log("Call accepted by:", from);
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on("ice-candidate", async ({ from, candidate }) => {
            console.log("ICE candidate received from:", from);
            try {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error("Error adding received ice candidate", e);
            }
        });

        return () => {
            socket.off("user-joined");
            socket.off("incoming-call");
            socket.off("call-accepted");
            socket.off("ice-candidate");
        };
    }, []);

    const joinRoom = async () => {
        if (roomId.trim() === "") {
            alert("Enter a room ID to join.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            // Send ICE candidates to other peer
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("ice-candidate", { to: roomId, candidate: event.candidate });
                }
            };

            // Receive remote tracks and display
            pc.ontrack = (event) => {
                remoteVideoRef.current.srcObject = event.streams[0];
            };

            // Add local tracks to peer connection
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            peerConnection.current = pc;

            socket.emit("join-room", roomId);
            setJoined(true);
        } catch (error) {
            console.error("Error accessing media devices:", error);
            alert("Could not access camera/microphone. Please allow permissions.");
        }
    };

    const callUser = async (userId) => {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("call-user", { userToCall: userId, offer });
    };

    const answerCall = async (from, offer) => {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("answer-call", { to: from, answer });
    };

    const endCall = async()=>{
      //  Stoppping all tracks of local stream
      if(localStream){
        localStream.getTracks().forEach(track=>track.stop());
      }

      // close peer connection
      if(peerConnection.current){
        peerConnection.current.close();
        peerConnection.current = null;
      }

      // clear remote video
      if(remoteVideoRef.current){
        remoteVideoRef.current.srcObject = null;
      }


      //Reset states
      setLocalStream(null);
      setJoined(false)
    }

    return (
        <div className="text-black flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 to-white p-4">
  <h1 className="text-2xl md:text-3xl font-bold text-indigo-700 mb-6">
    Private Video Calling App
  </h1>

  {!joined ? (
    <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-6 rounded-2xl shadow-lg">
      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        className="border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 p-3 rounded-lg w-64 transition"
      />
      <button
        onClick={joinRoom}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition shadow"
      >
        Join Room
      </button>
    </div>
  ) : (
    <div className="flex flex-col md:flex-row items-center gap-6 mt-6">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-medium text-gray-700">Your Video</h2>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-64 md:w-80 rounded-2xl shadow-lg border-2 border-indigo-200"
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-medium text-gray-700">Remote Video</h2>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-64 md:w-80 rounded-2xl shadow-lg border-2 border-indigo-200"
        />
      </div>
      <button
        onClick={endCall}
        className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg mt-4 md:mt-0 transition shadow"
      >
        End Call
      </button>
    </div>
  )}
</div>

    );
}

export default App;
