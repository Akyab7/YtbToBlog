from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
from groq import Groq
import re
import os

app = Flask(__name__)
CORS(app)

# Initialize Groq client
client = Groq(
    api_key='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'  # Directly set API key here if not using env variable
)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

def get_transcript(video_url):
    try:
        # Extract video ID from YouTube URL
        video_id = video_url.split("v=")[1].split("&")[0]  # Handle additional parameters
        # Retrieve transcript
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        # Convert transcript from list of dictionaries to a single string
        transcript_text = ' '.join(entry['text'] for entry in transcript)
        return transcript_text
    except Exception as e:
        print(f"Error retrieving transcript: {e}")
        return None

def structure_article(text):
    lines = text.split('\n')
    structured_article = {
        'title': '',
        'sections': []
    }
    current_section = None

    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for title (assuming it's the first non-empty line)
        if not structured_article['title']:
            structured_article['title'] = line.strip('*')  # Remove asterisks from title
            continue
        
        # Check for potential subtitle (shorter lines, often with asterisks)
        if line.startswith('**') and line.endswith('**'):
            subtitle = line.strip('*')  # Remove asterisks from subtitle
            current_section = {'subtitle': subtitle, 'paragraphs': []}
            structured_article['sections'].append(current_section)
        else:
            # It's a paragraph
            if current_section:
                current_section['paragraphs'].append(line)
            else:
                # If no section has been created yet, create one without a subtitle
                current_section = {'subtitle': '', 'paragraphs': [line]}
                structured_article['sections'].append(current_section)

    return structured_article

def process_with_gemma(transcript, keywords):
    keywords = keywords[:9]  # Limit to 9 keywords
    keyword_instruction = ""
    if keywords:
        keyword_instruction = f"Please incorporate the following keywords naturally into the article, ensuring each is used at least once: {', '.join(keywords)}."
    
    prompt = f"""
    Imagine you're a passionate blogger sharing insights on a topic you love.
    Write an engaging, conversational article that feels like a friend giving advice over coffee. 
    Your goal is to inform and inspire your readers, making complex ideas accessible and exciting.
    Keep these points in mind:
    1. Start with a catchy, intriguing title that makes readers curious.
    2. Open with a personal anecdote or thought-provoking question to hook the reader.
    3. Use clear subheadings (marked with **) to organize your main points.
    4. Write in a warm, conversational tone. Use "you" and "we" to connect with the reader.
    5. Include relatable examples, metaphors, or stories to illustrate your points.
    6. Vary your sentence structure - mix short, punchy sentences with longer, more detailed ones.
    7. End each section with a brief takeaway or question to keep readers engaged.
    8. Conclude with a call-to-action or reflection that inspires the reader.

    "add these keywords" {keyword_instruction}

    Remember:
    - Avoid jargon or overly technical language unless absolutely necessary.
    - Don't be afraid to inject humor or personality where appropriate.
    - Be inclusive and considerate in your language and examples.
    - Aim for a natural flow between ideas, as if you're guiding the reader through a conversation.

    Now, dive into this topic with your unique voice and perspective:

    {transcript}

    Let your enthusiasm for the subject shine through, and write as if you're sharing your thoughts with a good friend who's eager to learn from you.
    """

    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        model="llama3-8b-8192"  # Replace with the appropriate model
    )

    result = chat_completion.choices[0].message.content
    structured_result = structure_article(result)
    
    return structured_result  # Return structured data instead of raw text

@app.route('/')
def index():
    return 'Backend is up and running!'

@app.route('/process', methods=['POST'])
def process_video():
    video_url = request.json['video_url']
    keywords = request.json.get('keywords', [])  # Get keywords from request, default to empty list
    transcript = get_transcript(video_url)
    if not transcript:
        return jsonify({'error': 'Transcript not found'}), 404

    result = process_with_gemma(transcript, keywords)
    return jsonify({'result': result})

if __name__ == '__main__':
    app.run(debug=True)