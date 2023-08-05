import os
import wave
import numpy as np
import tensorflow as tf
import uuid
import threading
import io
import librosa
import serial
import pyaudio
import time
import queue
import matplotlib.pyplot as plt
from flask import Flask, jsonify, render_template, request, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from io import BytesIO

# List of libraries to check versions for
libraries = [
    "os",
    "wave",
    "numpy",
    "tensorflow",
    "uuid",
    "threading",
    "io",
    "librosa",
    "serial",
    "pyaudio",
    "time",
    "queue",
    "matplotlib",
    "socketio"
]

def print_library_versions():
    for lib in libraries:
        try:
            module = __import__(lib)
            print(f"{lib}: {module.__version__}")
        except AttributeError:
            print(f"{lib}: Version information not available")
        except ImportError:
            print(f"{lib}: Not installed")

if __name__ == "__main__":
    print_library_versions()
