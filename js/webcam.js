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
        gestureContainer.style.display = "none";
        objectContainer.style.display = "none";

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

let cocoModel;
const objectOutput = document.getElementById("object_output");

(async () => {
    cocoModel = await cocoSsd.load();
    console.log("COCO-SSD model loaded");
})();

let mode = "none";
let lastDetectedObject = ""; 

const gestureButton = document.getElementById("gestureButton");
const objectButton = document.getElementById("objectButton");
const gestureContainer = document.getElementById("gestureContainer");

gestureButton.addEventListener("click", () => {
    if (webcamRunning === false) {
        alert("Please enable the webcam first.");
        return;
    }
    mode = "gesture"; 
    gestureContainer.style.display = "block";
    objectContainer.style.display = "none";
    gestureOutput.style.display = "block"; 
    objectOutput.style.display = "none"; 
});

objectButton.addEventListener("click", () => {
    if (webcamRunning === false) {
        alert("Please enable the webcam first.");
        return;
    }
    mode = "object"; 
    objectContainer.style.display = "block";
    gestureContainer.style.display = "none";
    objectOutput.style.display = "block"; 
    gestureOutput.style.display = "none"; 
});

const textInput = document.getElementById("textInput");

function generateSignImagesFromText(text) {
    const container = document.getElementById("signImagesContainer");
    container.innerHTML = ""; 

    const cleanText = text.toLowerCase().replace(/[^a-z]/g, "");
    console.log(cleanText)
    for (const char of cleanText) {
        const img = document.createElement("img");
        img.src = `./image/${char}.png`; // Path to your image files
        img.alt = char;
        img.className = "w-16"
        container.appendChild(img);
    }

    container.classList.remove("hidden");
}

document.getElementById("generateSign").addEventListener("click", () => {
    if (!lastDetectedObject) {
        alert("Belum ada object yang terdeteksi.");
        return;
    } else {
        console.log(lastDetectedObject)
    }

    if (textInput.value === "") {
        alert("Please enter a text to generate sign images.");
    } else {
        const text = textInput.value;
        generateSignImagesFromText(text);
    }
    textInput.value = "";
})

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
    
    canvasCtx.drawImage(video, -video.videoWidth, 0, video.videoWidth, video.videoHeight); // Posisi flip

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

    // Mode handling: Gesture or Object
    if (mode === "gesture") {
        if (results.gestures.length > 0 && results.gestures[0][0].score >= 0.7) {
            const gesture = results.gestures[0][0];
            const categoryName = gesture.categoryName;
            const categoryScore = parseFloat(gesture.score * 100).toFixed(2);
            gestureOutput.innerText = `Detected Gesture: ${categoryName}\nConfidence: ${categoryScore}`;
            if (results.landmarks && results.landmarks.length > 0) {
                const indexFingerTip = results.landmarks[0][8]; // titik ujung jari telunjuk
                const x = indexFingerTip.x * canvasElement.width;
                const y = indexFingerTip.y * canvasElement.height;
            
                // Gambar huruf besar di atas tangan
                canvasCtx.font = "bold 40px Arial";
                canvasCtx.fillStyle = "cyan";
                canvasCtx.strokeStyle = "black";
                canvasCtx.lineWidth = 2;
                
                // Huruf dari hasil gesture
                const gestureLetter = categoryName.charAt(0).toUpperCase(); // Misalnya 'a', jadi 'A'
                
                canvasCtx.strokeText(gestureLetter, x, y - 10); // outline biar kontras
                canvasCtx.fillText(gestureLetter, x, y - 10);   // teks utama
            }
        } else {
            gestureOutput.innerText = `No Gesture Detected`;
        }    
    } else if (mode === "object") {
        if (cocoModel) {
            const predictions = await cocoModel.detect(video);
    
            // Clear object output
            objectOutput.innerText = "Detected Objects:\n";
    
            predictions.forEach(prediction => {
                const { class: objectClass, score } = prediction;
    
                // Only show objects with a confidence score > 0.5
                if (score > 0.5) {
                    objectOutput.innerText += `${objectClass} - Confidence: ${parseFloat(score * 100).toFixed(2)}%\n`;

                    lastDetectedObject = objectClass; 

                    const [x, y, width, height] = prediction.bbox;
                    canvasCtx.strokeStyle = "#FFA500"; 
                    canvasCtx.lineWidth = 2;
                    canvasCtx.strokeRect(x, y, width, height);

                    canvasCtx.fillStyle = "#FFA500"; 
                    canvasCtx.font = "16px Arial";
                    canvasCtx.fillText(`${objectClass} - ${parseFloat(score * 100).toFixed(2)}%`, x, y > 10 ? y - 5 : 10);

                    const cleanText = lastDetectedObject.toLowerCase().replace(/[^a-z]/g, "");
                    const baseX = x 
                    const baseY = y 

                    // Display image for each character in lastDetectedObject
                    for (let i = 0; i < cleanText.length; i++) {
                        const char = cleanText[i].toUpperCase();
                        const offsetX = i * 65; 
                        const img = new Image();
                        img.src = `./image/${char}.png`;  // Path to your image files
                        img.alt = char;
                        canvasCtx.drawImage(img, baseX + offsetX, baseY, 60, 90); 
                    }
                }
            });
    
            if (predictions.length === 0) {
                objectOutput.innerText = "No Objects Detected";
            }
        }
    }
    

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}


