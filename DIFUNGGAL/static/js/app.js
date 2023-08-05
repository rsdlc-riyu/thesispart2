document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM content loaded.");
  var socket = io.connect("http://" + document.domain + ":" + location.port);
  var audioContext;
  var analyser;
  var waveformCanvas;
  var waveformCtx;
  var spectrogramCanvas;
  var spectrogramCtx;
  var chromagramCanvas;
  var chromagramCtx;
  var spectralCanvas;
  var spectralCtx;
  var isPlaying = false;
  var mediaStreamSource;
  var dataArray;
  var animationFrameId;
  var distressCounts = {};
  var timeIndex = 0;
  var distressCountsDisplay;


  function startAudio() {
    if (isPlaying) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 8192;
    var bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    waveformCanvas = document.getElementById("waveformCanvas");
    waveformCtx = waveformCanvas.getContext("2d");

    spectrogramCanvas = document.getElementById("spectrogramCanvas");
    spectrogramCtx = spectrogramCanvas.getContext("2d");

    chromagramCanvas = document.getElementById("chromagramCanvas");
    chromagramCtx = chromagramCanvas.getContext("2d");

    spectralCanvas = document.getElementById("spectralCanvas");
    spectralCtx = spectralCanvas.getContext("2d");

    distressCountsDisplay = document.getElementById("distressCountsDisplay");

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        mediaStreamSource = audioContext.createMediaStreamSource(stream);
        mediaStreamSource.connect(analyser);

        // Start the audio processing and visualization
        isPlaying = true;
        drawWaveform();
        drawSpectrogram();
        drawChromagram();
        drawSpectral();
      })
      .catch(function (error) {
        console.log('Error accessing microphone:', error);
      });
  }

  const startAudioButton = document.getElementById("startAudioButton");
  if (startAudioButton) {
    startAudioButton.addEventListener("click", startAudio);
  } else {
    console.log("Error: startAudioButton not found.");
  }

  function drawWaveform() {
  if (!isPlaying) return;

  requestAnimationFrame(drawWaveform);
  analyser.getByteTimeDomainData(dataArray);

  waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  waveformCtx.fillStyle = 'rgb(255, 255, 255)';
  waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  waveformCtx.lineWidth = 2;
  waveformCtx.strokeStyle = 'rgb(255, 0, 0)';
  waveformCtx.beginPath();

  var sliceWidth = waveformCanvas.width * 1.0 / dataArray.length;
  var x = 0;

  for (var i = 0; i < dataArray.length; i++) {
    var v = (dataArray[i] / 128.0) - 1;
    var y = (waveformCanvas.height / 2) - (v * waveformCanvas.height / 4);

    if (i === 0) {
      waveformCtx.moveTo(x, y);
    } else {
      waveformCtx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
  waveformCtx.stroke();

  // Draw y-axis
  waveformCtx.beginPath();
  waveformCtx.moveTo(0, 0);
  waveformCtx.lineTo(0, waveformCanvas.height);
  waveformCtx.strokeStyle = 'rgb(150, 150, 150)';
  waveformCtx.stroke();

// Draw axis labels for amplitude
waveformCtx.fillStyle = 'rgb(0, 0, 0)';
waveformCtx.textAlign = 'right';

var labelSpacing = waveformCanvas.height / 5; // Spacing between labels
var startY = labelSpacing - labelSpacing / 5; // Starting y-coordinate for the first label, adjusted one step higher

waveformCtx.fillText('4', 10, startY);
waveformCtx.fillText('2', 10, startY + labelSpacing);
waveformCtx.fillText('0', 10, startY + 2 * labelSpacing);
waveformCtx.fillText('-2', 10, startY + 3 * labelSpacing);
waveformCtx.fillText('-4', 10, startY + 4 * labelSpacing);


  // Draw axis labels for time
  waveformCtx.textAlign = 'center';
  waveformCtx.fillText('1', waveformCanvas.width * 0.1, waveformCanvas.height - 10);
  waveformCtx.fillText('2', waveformCanvas.width * 0.3, waveformCanvas.height - 10);
  waveformCtx.fillText('3', waveformCanvas.width * 0.5, waveformCanvas.height - 10);
  waveformCtx.fillText('4', waveformCanvas.width * 0.7, waveformCanvas.height - 10);
  waveformCtx.fillText('5', waveformCanvas.width * 0.9, waveformCanvas.height - 10);

    // Update waveform values
    var amplitude = getAmplitude();
    var time = getTime();
    document.getElementById("waveformValues").innerHTML = `<b>Amplitude:</b> ${amplitude} dB<br><b>Time:</b> ${time} s`;
  }

  function drawSpectrogram() {
  if (!isPlaying) return;

  requestAnimationFrame(drawSpectrogram);
  analyser.getByteFrequencyData(dataArray);

  spectrogramCtx.clearRect(0, 0, spectrogramCanvas.width, spectrogramCanvas.height);
  spectrogramCtx.fillStyle = 'rgb(0, 0, 0)';
  spectrogramCtx.fillRect(0, 0, spectrogramCanvas.width, spectrogramCanvas.height);

  var barWidth = spectrogramCanvas.width / dataArray.length;

  for (var i = 0; i < dataArray.length; i++) {
    var barHeight = dataArray[i] * spectrogramCanvas.height / 255;

    spectrogramCtx.fillStyle = 'rgb(' + (barHeight + 100) + ', 50, 50)';
    spectrogramCtx.fillRect(i * barWidth, spectrogramCanvas.height - barHeight, barWidth, barHeight);
  }

  // Draw x-axis
  spectrogramCtx.beginPath();
  spectrogramCtx.moveTo(0, spectrogramCanvas.height);
  spectrogramCtx.lineTo(spectrogramCanvas.width, spectrogramCanvas.height);
  spectrogramCtx.strokeStyle = 'rgb(150, 150, 150)';
  spectrogramCtx.stroke();

  // Draw y-axis
  spectrogramCtx.beginPath();
  spectrogramCtx.moveTo(0, 0);
  spectrogramCtx.lineTo(0, spectrogramCanvas.height);
  spectrogramCtx.strokeStyle = 'rgb(150, 150, 150)';
  spectrogramCtx.stroke();

  // Draw axis labels for frequency
  spectrogramCtx.fillStyle = 'rgb(255, 255, 255)';
  spectrogramCtx.textAlign = 'right';

  var labelSpacing = spectrogramCanvas.height / 5; // Spacing between labels
  var startY = labelSpacing - labelSpacing / 5; // Starting y-coordinate for the first label, adjusted one step higher

  spectrogramCtx.fillText('4000', 10, startY);
  spectrogramCtx.fillText('3000', 10, startY + labelSpacing);
  spectrogramCtx.fillText('2000', 10, startY + 2 * labelSpacing);
  spectrogramCtx.fillText('1000', 10, startY + 3 * labelSpacing);
  spectrogramCtx.fillText('0', 10, startY + 4 * labelSpacing);

  // Draw axis labels for magnitude
  spectrogramCtx.textAlign = 'center';
  spectrogramCtx.fillText('1', spectrogramCanvas.width * 0.1, spectrogramCanvas.height - 10);
  spectrogramCtx.fillText('2', spectrogramCanvas.width * 0.3, spectrogramCanvas.height - 10);
  spectrogramCtx.fillText('3', spectrogramCanvas.width * 0.5, spectrogramCanvas.height - 10);
  spectrogramCtx.fillText('4', spectrogramCanvas.width * 0.7, spectrogramCanvas.height - 10);
  spectrogramCtx.fillText('5', spectrogramCanvas.width * 0.9, spectrogramCanvas.height - 10);

  // Update spectrogram values
  var frequency = getFrequency();
  var magnitude = getMagnitude();
  document.getElementById("spectrogramValues").innerHTML = `<b>Frequency:</b> ${frequency} Hz<br><b>Magnitude:</b> ${magnitude} dB`;
}

function drawChromagram() {
  if (!isPlaying) return;

  requestAnimationFrame(drawChromagram);
  analyser.getByteFrequencyData(dataArray);

  chromagramCtx.clearRect(0, 0, chromagramCanvas.width, chromagramCanvas.height);
  chromagramCtx.fillStyle = 'rgb(0, 0, 0)';
  chromagramCtx.fillRect(0, 0, chromagramCanvas.width, chromagramCanvas.height);

  var numPitchClasses = 12;
  var binWidth = chromagramCanvas.width / numPitchClasses;
  var pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  var timeIndex = 0;
  for (var i = 0; i < numPitchClasses; i++) {
    var hue = i * (360 / numPitchClasses);
    var saturation = 100;

    var y = chromagramCanvas.height - (dataArray[timeIndex] / 5.55); // Scale the amplitude
    chromagramCtx.strokeStyle = 'hsl(' + hue + ', ' + saturation + '%, 75%)';
    chromagramCtx.beginPath();
    chromagramCtx.moveTo(i * binWidth, y);

    for (var j = 1; j < chromagramCanvas.width / binWidth; j++) {
      var dataIndex = timeIndex + j;
      var amplitude = dataArray[dataIndex % dataArray.length] / 5.55; // Scale the amplitude
      var x = i * binWidth + j * binWidth;
      y = chromagramCanvas.height - amplitude;
      chromagramCtx.lineTo(x, y);
    }

    chromagramCtx.stroke();
  }

  // Draw x-axis (pitch classes)
  chromagramCtx.beginPath();
  chromagramCtx.moveTo(0, chromagramCanvas.height);
  chromagramCtx.lineTo(chromagramCanvas.width, chromagramCanvas.height);
  chromagramCtx.strokeStyle = 'rgb(150, 150, 150)';
  chromagramCtx.stroke();

  // Draw axis labels for pitch class (x-axis)
  chromagramCtx.fillStyle = 'rgb(255, 255, 255)';
  chromagramCtx.textAlign = 'center';

  for (var i = 0; i < numPitchClasses; i++) {
    var labelX = (i + 0.5) * binWidth;
    var labelY = chromagramCanvas.height - 10;
    chromagramCtx.fillText(pitchClasses[i], labelX, labelY);
  }

  // Draw axis labels for time (y-axis)
  chromagramCtx.textAlign = 'right';
  chromagramCtx.fillText('1', 10, 20);
  chromagramCtx.fillText('2', 10, chromagramCanvas.height * 0.3);
  chromagramCtx.fillText('3', 10, chromagramCanvas.height * 0.5);
  chromagramCtx.fillText('4', 10, chromagramCanvas.height * 0.7);
  chromagramCtx.fillText('5', 10, chromagramCanvas.height * 0.9);

  // Update chromagram values
  var pitchClass = getPitchClass();
  document.getElementById("chromagramValues").innerHTML = `<b>Pitch Class:</b> ${pitchClass}`;
  
  // Increment time index
  timeIndex++;
}

var spectralCanvas = document.getElementById('spectralCanvas');
var spectralCtx = spectralCanvas.getContext('2d');

function drawSpectral() {
  if (!isPlaying) return;

  requestAnimationFrame(drawSpectral);
  analyser.getByteFrequencyData(dataArray);

  spectralCtx.clearRect(0, 0, spectralCanvas.width, spectralCanvas.height);
  spectralCtx.fillStyle = 'rgb(0, 0, 0)';
  spectralCtx.fillRect(0, 0, spectralCanvas.width, spectralCanvas.height);

  var binWidth = spectralCanvas.width / dataArray.length;

  for (var i = 0; i < dataArray.length; i++) {
    var hue = i * (360 / dataArray.length);
    var saturation = 100;
    var lightness = dataArray[i] / 2.55;

    spectralCtx.fillStyle = 'hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)';
    spectralCtx.fillRect(i * binWidth, spectralCanvas.height - (dataArray[i] / 2), binWidth, dataArray[i] / 2);
  }

  // Draw x-axis
  spectralCtx.beginPath();
  spectralCtx.moveTo(0, spectralCanvas.height);
  spectralCtx.lineTo(spectralCanvas.width, spectralCanvas.height);
  spectralCtx.strokeStyle = 'rgb(150, 150, 150)';
  spectralCtx.stroke();

  // Draw y-axis
  spectralCtx.beginPath();
  spectralCtx.moveTo(0, 0);
  spectralCtx.lineTo(0, spectralCanvas.height);
  spectralCtx.strokeStyle = 'rgb(150, 150, 150)';
  spectralCtx.stroke();

  // Draw axis labels for magnitude
  spectralCtx.fillStyle = 'rgb(255, 255, 255)';
  spectralCtx.textAlign = 'right';

  var labelSpacing = spectralCanvas.height / 5; // Spacing between labels
  var startY = spectralCanvas.height - labelSpacing + labelSpacing / 5; // Starting y-coordinate for the first label, adjusted one step lower

  for (var i = 0; i <= 5; i++) {
    var labelX = spectralCanvas.width - 10;
    var labelY = startY - i * labelSpacing;
    var magnitude = i * 20; // Adjust the magnitude values as needed
    spectralCtx.fillText(magnitude + ' dB', labelX, labelY);
  }

  // Draw axis labels for frequency
  spectralCtx.textAlign = 'center';
  spectralCtx.fillText('0 Hz', 10, spectralCanvas.height - 10);
  spectralCtx.fillText('Sample Rate/2', spectralCanvas.width / 2, spectralCanvas.height - 10);
  spectralCtx.fillText('Sample Rate', spectralCanvas.width - 10, spectralCanvas.height - 10);

  // Update spectral display values
  var frequency = getFrequency();
  var magnitude = getMagnitude();
  document.getElementById("spectralValues").innerHTML = `<b>Frequency:</b> ${frequency} Hz<br>Magnitude:</b> ${magnitude} dB`;
}

function getAmplitude() {
  var minDecibels = analyser.minDecibels === -Infinity ? 0 : analyser.minDecibels;
  var maxDecibels = analyser.maxDecibels === -Infinity ? 0 : analyser.maxDecibels;
  var amplitude = 20 * (Math.log10(maxDecibels - minDecibels) - Math.log10(256)) + 100;
  return amplitude.toFixed(2);
}

  function getTime() {
    var time = audioContext.currentTime.toFixed(2);
    return time;
  }

  function getFrequency() {
    var maxIndex = 0;
    var maxMagnitude = 0;

    for (var i = 0; i < dataArray.length; i++) {
      if (dataArray[i] > maxMagnitude) {
        maxMagnitude = dataArray[i];
        maxIndex = i;
      }
    }

    var frequency = maxIndex * audioContext.sampleRate / analyser.fftSize;
    return frequency.toFixed(2);
  }

  function getMagnitude() {
    var maxMagnitude = 0;

    for (var i = 0; i < dataArray.length; i++) {
      if (dataArray[i] > maxMagnitude) {
        maxMagnitude = dataArray[i];
      }
    }

    var magnitude = 20 * (Math.log10(maxMagnitude) - Math.log10(256));
    return magnitude.toFixed(2);
  }

  function getPitchClass() {
    var maxIndex = 0;
    var maxMagnitude = 0;

    for (var i = 0; i < dataArray.length; i++) {
      if (dataArray[i] > maxMagnitude) {
        maxMagnitude = dataArray[i];
        maxIndex = i;
      }
    }

    var frequency = maxIndex * audioContext.sampleRate / analyser.fftSize;
    var pitchClass = frequency.toFixed(2);
    return pitchClass;
  }

// Listen for new history log events from the server
socket.on('new_history_log', function(newLog) {
    // Create a new table row
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${newLog.date}</td>
        <td>${newLog.time}</td>
        <td>${newLog.distress_type}</td>
        <td>
            <form action="/delete_log/${newLog.id}" method="POST">
                <button type="submit" class="btn btn-danger btn-sm">Delete</button>
            </form>
        </td>
    `;

    // Insert the new row at the top of the table
    const tableBody = document.getElementById('historyLogsTableBody');
    tableBody.insertBefore(newRow, tableBody.firstChild);
});

// Event listener to receive the distress counts from the server
socket.on("distress_counts", function (data) {
  var distressCounts = data;
  console.log("Received distress counts:", distressCounts);

  updateDistressCountsDisplay(distressCounts);
});

function updateDistressCountsDisplay(distressCounts) {
  console.log("Updating distress counts display:", distressCounts);

  var distressCountsDisplay = document.getElementById("distressCountsDisplay");
  distressCountsDisplay.innerHTML = "";

  for (var distressType in distressCounts) {
    var count = distressCounts[distressType];
    var distressCountElement = document.createElement("p");
    distressCountElement.textContent = `${distressType}: ${count}`;
    distressCountsDisplay.appendChild(distressCountElement);
  }
}

// Function to update the current phone number display
function updatePhoneNumberDisplay() {
  fetch('/get_phone_number')
      .then(response => response.json())
      .then(data => {
          const phoneNumberDisplay = document.getElementById('phone-number-display');
          phoneNumberDisplay.textContent = data.phone_number;

          // Display phone number confirmation message
          const phoneNumberConfirmation = document.getElementById('phoneNumberConfirmation');
          phoneNumberConfirmation.textContent = `Phone number updated: ${data.phone_number}`;
      });
}

// Function to update the phone number on the backend
function updatePhoneNumber() {
  const phoneNumber = document.getElementById('phone-number').value;

  // Send the phone number to the backend to update
  fetch('/set_phone_number', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          phone_number: phoneNumber
      })
  })
  .then(response => response.json())
  .then(data => {
      console.log(data.message);  // Optional: Log the response message
      updatePhoneNumberDisplay(); // Update the current phone number display
      sendSMS(); // Send SMS when the phone number is updated

      // Display phone number confirmation message
      const phoneNumberConfirmation = document.getElementById('phoneNumberConfirmation');
      phoneNumberConfirmation.textContent = `Phone number updated: ${phoneNumber}`;
  });
}

// Fetch and display the current phone number on page load
updatePhoneNumberDisplay();

const updatePhoneNumberButton = document.getElementById("updatePhoneNumberButton");
if (updatePhoneNumberButton) {
  updatePhoneNumberButton.addEventListener("click", updatePhoneNumber);
} else {
  console.log("Error: updatePhoneNumberButton not found.");
}

// Function to send SMS
function sendSMS() {
  console.log("Sending SMS...");
  socket.emit("send_sms");
}

// Listen for SMS status update events from the server
socket.on('sms_status', function(status) {
  updateSMSStatus(status);
  // Display SMS confirmation message
  const smsConfirmation = document.getElementById('smsConfirmation');
  smsConfirmation.textContent = `SMS Status: ${status}`;
});
});
