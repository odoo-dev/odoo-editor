#!/usr/bin/env python3

from flask import Flask, send_from_directory, request, jsonify
import flask_restful as restful

import time

app = Flask(__name__)
api = restful.Api(app)

app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

history = [1]             # TODO: use an ordered dict instead
history_patch = {1: {
    'cursor': {},
    'dom': [
        {'type': 'add', 'append': 1, 'id': 1, 'node':
            {
                'nodeType': 1, 'oid': 1873262997,
                'tagName': 'H1',
                'children': [{
                    'nodeType': 3, 'oid': 1550618946,
                    'textValue': 'A Collaborative Title'
                }],
                'attributes': {}
            }
        }
    ],
    'id': 1
}}


@app.route('/')
def index():
    return open('index.html').read()

@app.route('/<path:path>')
def send_js(path):
    return send_from_directory('', path)

@app.route('/history-push', methods = ['POST'])
def history_push():
    data = request.get_json()
    print(data)
    history.append(data['id'])
    history_patch[data['id']] = data
    return {'status': 200}

class history_get(restful.Resource):
    def get(self, oid=0):
        index = 0
        if oid:
            index = history.index(oid)+1
            while index==len(history):
                time.sleep(0.1)

        result = [history_patch[x] for x in history[index:]]
        print('Get After', oid,':', [x for x in history[index:]])
        return result
api.add_resource(history_get, '/history-get/<int:oid>')

if __name__ == '__main__':
    app.run(port=8000, debug=True)
