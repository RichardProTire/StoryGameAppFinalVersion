from flask import Flask, jsonify, request
from flask_pymongo import PyMongo
from flask_cors import CORS
from bson import json_util


app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})
app.config['MONGO_URI'] = 'mongodb://localhost:27017/wordbank'
mongo = PyMongo(app)

# Add default values for persons, places, and things
default_word_bank = {
    'persons': ['Batman', 'Private Bloggins', 'The Rock'],
    'places': ['Beach', 'Mountain', 'Railway'],
    'things': ['Hat', 'Selfie', 'Pencil'],
}

# Initialize the word bank with default values if not already present
mongo.db.wordbank.update_one({}, {'$setOnInsert': default_word_bank}, upsert=True)  # Use consistent case here

# API endpoint to get the word bank
@app.route('/api/wordbank', methods=['GET'])
def get_word_bank():
    try:
        word_bank = mongo.db.wordbank.find_one({}, {'_id': False})
        # Convert MongoDB document to Python dictionary using json_util
        return jsonify(json_util.loads(json_util.dumps(word_bank)) or {'persons': [], 'places': [], 'things': []})
    except Exception as e:
        print(e)
        return jsonify({'error': 'Internal Server Error'}), 500

# API endpoint to save the word bank
@app.route('/api/wordbank', methods=['POST'])
def save_word_bank():
    try:
        updatedwordbank = request.get_json()
        persons = updatedwordbank.get('persons', [])
        places = updatedwordbank.get('places', [])
        things = updatedwordbank.get('things', [])

        word_bank = mongo.db.wordbank.find_one_and_update(
            {},
            {'$set': {'persons': persons, 'places': places, 'things': things}},
            upsert=True,
            return_document=True,
            projection={'_id': False}  # Exclude the _id field from the result
        )
        # Convert MongoDB document to Python dictionary using json_util
        return jsonify(json_util.loads(json_util.dumps(word_bank)))
    # error handling must show error. Currently adding to the database creates an error in the console log of the react app
    except Exception as e:
        print(e)
        return jsonify({'error': f'Internal Server Error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
