#!/usr/bin/env python3

from flask import Flask, send_from_directory, request, jsonify
import flask_restful as restful

import time

app = Flask(__name__)
api = restful.Api(app)

app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

history = []
history_patch = {}

@app.route('/')
def index():
    return open('index.html').read()

@app.route('/<path:path>')
def send_js(path):
    return send_from_directory('', path)

class history_get(restful.Resource):
    def get(self, lastoid=0):
        index = lastoid and history.index(lastoid)
        while index<=len(history):
            time.sleep(0.5)
        return {'history': history[index:], 'status': 200}

@app.route('/history-push', methods = ['GET', 'POST', 'DELETE'])
def history_push():
    print('Adding', request.data, request.get_json())

    # history_patch[oid] = data
    # history.append(oid)
    return jsonify({'status': 200, 'yop': True})

api.add_resource(history_get, '/history-get')


if __name__ == '__main__':
    app.run(port=8000, debug=True)
