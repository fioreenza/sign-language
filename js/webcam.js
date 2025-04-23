import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
import { GESTURE_MODEL_URL } from "./config.js";

let gestureRecognizer;
let runningMode = "IMAGE";
let webcamRunning = false;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");
const enableWebcamButton = document.getElementById("webcamButton");
const loadingIndicator = document.getElementById("loadingIndicator");

// Inisialisasi
const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: GESTURE_MODEL_URL,
            delegate: "GPU"
        },
        runningMode: runningMode
    });
};
createGestureRecognizer();

function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
    enableWebcamButton.textContent = "Webcam Not Supported";
    enableWebcamButton.disabled = true;
}

async function enableCam() {
    if (!gestureRecognizer) {
        alert("Please wait for gestureRecognizer to load");
        return;
    }

    if (webcamRunning) {
        webcamRunning = false;
        enableWebcamButton.textContent = "Enable Camera";

        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;

        loadingIndicator.classList.add("hidden");
    } else {
        webcamRunning = true;
        enableWebcamButton.textContent = "Disable Camera";
        loadingIndicator.classList.remove("hidden");

        try {
            const constraints = { video: { width: 640, height: 480 } };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            video.addEventListener("loadeddata", () => {
                loadingIndicator.classList.add("hidden");
                predictWebcam();
            }, { once: true });
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Error accessing webcam. Please make sure you have granted camera permissions.");
            loadingIndicator.classList.add("hidden");
        }
    }
}

let lastVideoTime = -1;
let results = undefined;

async function predictWebcam() {
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }

    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = gestureRecognizer.recognizeForVideo(video, nowInMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 2
            });
            drawingUtils.drawLandmarks(landmarks, {
                color: "#FF0000",
                lineWidth: 1
            });
        }
    }

    canvasCtx.restore();

    if (results.gestures.length > 0 && results.gestures[0][0].score >= 0.7) {
        gestureOutput.style.display = "block";
        const gesture = results.gestures[0][0];
        const handedness = results.handednesses[0][0].displayName;
        const categoryName = gesture.categoryName;
        const categoryScore = parseFloat(gesture.score * 100).toFixed(2);

        gestureOutput.innerText = `Detected Sign: ${categoryName}\nConfidence: ${categoryScore}%\nHand: ${handedness}`;
    } else {
        gestureOutput.style.display = "block";
        gestureOutput.innerText = `No Gesture Detected`;
    }

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}