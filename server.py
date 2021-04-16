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

history = {}
# Steps whose previous id is referencing a step we did not receive yet. This
# situation should not happen with websockets. With http requests, the missing
# step must arrive eventually.
historyBuffer = {}

@socketio.on('step')
def on_history_step(step):
    if step['previousStepId'] != 'FIRST_STEP_PREVIOUS_ID' and not history.get(step['previousStepId']):
        # Store step in the buffer by previous id, so that when the step
        # with that id is inserted, we can easily find the potential step
        # that references it
        historyBuffer[step['previousStepId']] = step
    else:
        add_step_to_history(step)

def add_step_to_history(step):
    step['index'] = len(history)
    history[step['id']] = step
    emit('step', step, broadcast=True, json=True)
    next_step = historyBuffer.get(step['id'])
    if next_step:
        add_step_to_history(next_step)


@socketio.on('init')
def on_init(incoming_history):
    if len(history) == 0:
        for step in incoming_history:
            history[step['id']] = step
    else:
        emit('synchronize', history_as_list(), json=True)



@socketio.on('requestSynchronization')
def on_request_synchronization():
    emit('synchronize', history_as_list(), json=True)

def history_as_list():
    history_as_list = list(history.values())
    history_as_list.sort(key=lambda step: step['index'])
    return history_as_list


if __name__ == '__main__':
    socketio.run(app)
