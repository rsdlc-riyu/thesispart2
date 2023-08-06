import os
import wave
import numpy as np
import tensorflow as tf
import uuid
import threading
import librosa
import serial
import pyaudio
import queue
from flask import Flask, jsonify, render_template, request, Response, send_file, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from reportlab.pdfgen import canvas

app = Flask(__name__, static_url_path='/static')
socketio = SocketIO(app, cors_allowed_origins='*')
CORS(app)
# app.config['SECRET_KEY'] = 'b880774a78a36ec4afe090493af57ddac1934ea1c7d9b1b4223f6afc33c5f931'

Base = declarative_base()

class HistoryLog(Base):
    __tablename__ = 'history_log'
    id = Column(Integer, primary_key=True)
    datetime = Column(DateTime, nullable=False)
    distress_type = Column(String, nullable=False)

engine = create_engine('sqlite:///distress_history.db', echo=True)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
db_session = Session()

serial_port = 'COM7'
baud_rate = 9600
audio_queue = queue.Queue()

model_path = 'ChicDistressVocalizations3.h5'
model = tf.keras.models.load_model(model_path)

classes = {
    0: "Normal",
    1: "Chicken is Disturbed",
    2: "Chicken is in Danger",
    3: "Chicken is Threatened",
    4: "Background Noise",

}

distress_counts = {
    "Normal": 0,
    "Chicken is Disturbed": 0,
    "Chicken is in Danger": 0,
    "Chicken is Threatened": 0,
    "Background Noise": 0,
}

CHUNK_SIZE = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 48000
frames = []
phone_number = None
MAX_FRAMES = 38

def extract_features(audio_data):
    audio_data = np.frombuffer(audio_data, dtype=np.int16) / 32768.0
    temp_dir = 'temp_files'
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f'temp_{uuid.uuid4().hex}.wav')
    with wave.open(temp_path, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(audio_data.tobytes())

    # Load the temporary WAV file and extract features using librosa
    audio, _ = librosa.load(temp_path, sr=RATE)
    os.remove(temp_path)  # Clean up temporary file

    mfcc_features = librosa.feature.mfcc(y=audio, sr=RATE, n_mfcc=20, n_fft=2048)
    
    if mfcc_features.shape[1] < MAX_FRAMES:
        mfcc_features = np.pad(mfcc_features, ((0, 0), (0, MAX_FRAMES - mfcc_features.shape[1])), mode='constant')
    else:
        mfcc_features = mfcc_features[:, :MAX_FRAMES]
    
    mfcc_features = (mfcc_features - np.mean(mfcc_features)) / np.std(mfcc_features)
    mfcc_features = mfcc_features[np.newaxis, ..., np.newaxis]
    return mfcc_features


def predict_distress(audio_data):
    features = extract_features(audio_data)
    prediction = model.predict(features)
    predicted_label = np.argmax(prediction)
    predicted_class = classes[predicted_label]
    return predicted_class

def capture_audio_data(duration=3):
    global audio_queue
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    frames_per_buffer=CHUNK_SIZE)
    data_duration = int(RATE / CHUNK_SIZE * duration)
    for i in range(data_duration):
        data = stream.read(CHUNK_SIZE)
        audio_queue.put(data)
    stream.stop_stream()
    stream.close()
    p.terminate()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/audio_feed')
def audio_feed():
    return Response(capture_audio_data(), mimetype='audio/x-wav')

def emit_updated_distress_counts():
    filtered_distress_counts = {key: value for key, value in distress_counts.items() if key not in ["Normal", "Background Noise"]}
    socketio.emit('distress_counts', filtered_distress_counts)
    print("Emitted updated distress counts:", filtered_distress_counts)


@app.route('/set_phone_number', methods=['POST'])
def set_phone_number():
    global phone_number
    data = request.get_json()
    phone_number = data.get('phone_number')
    print("Received Phone Number:", phone_number)
    return jsonify({'message': 'Phone number set successfully!'})

@app.route('/get_phone_number', methods=['GET'])
def get_phone_number():
    global phone_number
    return jsonify({'phone_number': phone_number})

def send_to_iot(phone_number, distress_type):
    if phone_number:
        command = f"PHONE:{phone_number},DISTRESS:{distress_type}\n"
        with serial.Serial(serial_port, baud_rate) as ser:
            ser.write(command.encode('utf-8'))
            ser.flush()
        print("Data sent to IoT:", command)

@app.route('/classify', methods=['POST'])
def classify_audio():
    data = request.get_json()
    audio_data = data.get('audio_data')
    global frames
    frames = []
    audio_thread = threading.Thread(target=capture_audio_data, args=(3,))
    audio_thread.start()
    audio_thread.join()
    while not audio_queue.empty():
        data = audio_queue.get()
        frames.append(data)
    full_audio_data = b''.join(frames)
    distress_type = predict_distress(full_audio_data)
    print("Predicted Distress Type:", distress_type)
    
    if distress_type != "Normal" and distress_type != "Background Noise":
        distress_counts[distress_type] += 1
        history_log = HistoryLog(
            datetime=datetime.now(),
            distress_type=distress_type,
        )
        db_session.add(history_log)
        db_session.commit()

        send_to_iot(phone_number, distress_type)

        # Emit a SocketIO event to notify the frontend about the new log
        socketio.emit('new_history_log', {
            'id': history_log.id,
            'date': history_log.datetime.strftime('%Y-%m-%d'),
            'time': history_log.datetime.strftime('%H:%M:%S'),
            'distress_type': history_log.distress_type
        }, namespace='/')

        emit_updated_distress_counts()
    return jsonify({'distress_type': distress_type})

def generate_pdf(history_log):
    pdf_file = "distress_logs.pdf"
    c = canvas.Canvas(pdf_file)
    c.drawString(72, 800, "History Logs")
    y = 750
    for log in history_log:
        c.drawString(72, y, f"Date and Time: {log.datetime} Distress Type: {log.distress_type}")
        y -= 20
    c.save()
    return pdf_file

@app.route('/history_log', methods=['GET', 'POST'])
def history_log():
    search_query = request.form.get('query')
    if search_query:
        search_results = HistoryLog.query.filter(
            (HistoryLog.distress_type.ilike(f'%{search_query}%')) |
            (HistoryLog.datetime.ilike(f'%{search_query}%'))
        ).all()
        count = len(search_results)

        if count > 0:
            return render_template('index.html', search_results=search_results, search_query=search_query,
                                   count=count)
        else:
            return render_template('index.html', no_results=True, search_query=search_query)
    else:
        history_log = HistoryLog.query.order_by(HistoryLog.id.desc()).all()
        return render_template('index.html', history_log=history_log)

@app.route('/delete_log/<int:log_id>', methods=['POST'])
def delete_log(log_id):
    log = HistoryLog.query.get(log_id)
    if log:
        db_session.delete(log)
        db_session.commit()

@app.route('/download_history', methods=['POST'])
def download_history():
    from_date_str = request.form.get('from_date')
    to_date_str = request.form.get('to_date')

    from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
    to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()

    history = HistoryLog.query.filter(HistoryLog.date.between(from_date, to_date)).all()

    generate_pdf(history)

    return send_file('chic_report.pdf', as_attachment=True)

# Define the route for the index page
@app.route('/')
def index():
    return render_template('index.html')

# Define the route for the logs page
@app.route('/logs')
def logs():
    return render_template('logs.html')

# Add the new route for the "Cages" page
@app.route('/cages')
def cages():
    return render_template('cages.html')

@app.route('/clear-logs', methods=['POST'])
def clear_logs():
    HistoryLog.query.delete()
    db_session.commit()

    return redirect(url_for('index'))

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)