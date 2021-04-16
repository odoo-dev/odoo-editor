#!/usr/bin/env python3

from flask import Flask, send_from_directory
import flask_restful as restful
from flask_cors import CORS
from flask_socketio import SocketIO, emit

app = Flask(__name__)
CORS(app)
api = restful.Api(app)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.route('/')
def index():
    return open('dev/index.html').read()


@app.route('/<path:path>')
def send_js(path):
    return send_from_directory('dev', path)




history = []

@socketio.on('step')
def on_history_step(step):
    step_index = len(history)
    step['index'] = step_index
    history.append(step)
    emit('step', step, broadcast=True, json=True)

@socketio.on('init')
def on_init(incoming_history):
    if len(history) == 0:
        history.extend(incoming_history)
    else:
        emit('synchronize', history, json=True)

@socketio.on('needSync')
def on_need_sync():
    emit('synchronize', history, json=True)

if __name__ == '__main__':
    socketio.run(app)
