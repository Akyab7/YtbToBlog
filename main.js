let keywords = [];

function addKeyword(keyword) {
    keyword = keyword.trim();
    if (keyword && keywords.length < 9 && !keywords.includes(keyword)) {
        keywords.push(keyword);
        updateKeywordTags();
    }
}

function removeKeyword(keyword) {
    keywords = keywords.filter(k => k !== keyword);
    updateKeywordTags();
}

function updateKeywordTags() {
    const tagContainer = document.getElementById('keywordTags');
    tagContainer.innerHTML = '';
    keywords.forEach(keyword => {
        const tag = document.createElement('span');
        tag.classList.add('keyword-tag');
        tag.textContent = keyword;
        tag.onclick = () => removeKeyword(keyword);
        tagContainer.appendChild(tag);
    });
    document.getElementById('keywordCounter').textContent = `${keywords.length}/9 keywords added`;
}

document.getElementById('keywordInput').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const inputKeywords = this.value.split(',').map(k => k.trim()).filter(k => k);
        inputKeywords.forEach(keyword => addKeyword(keyword));
        this.value = '';
    }
});

document.getElementById('convertButton').addEventListener('click', function() {
    const videoUrl = document.getElementById('youtubeLink').value;

    console.log('Showing loading spinner');
    document.getElementById('loadingSpinner').classList.remove('d-none');
    document.getElementById('outputContainer').classList.add('d-none');

    fetch('http://127.0.0.1:5000/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ video_url: videoUrl, keywords: keywords })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        document.getElementById('loadingSpinner').classList.add('d-none');
        document.getElementById('outputContainer').classList.remove('d-none');
        typeStructuredText(data.result, keywords);
    })
    .catch((error) => {
        console.error('Error:', error);
        document.getElementById('loadingSpinner').classList.add('d-none');
        alert('Failed to fetch data: ' + error.message);
    });
});

function typeStructuredText(structuredArticle, keywords) {
    const articleContent = document.getElementById('articleContent');
    articleContent.innerHTML = ''; // Clear existing content

    const elements = [
        { tag: 'h1', text: structuredArticle.title },
        ...structuredArticle.sections.flatMap(section => [
            section.subtitle ? { tag: 'h2', text: section.subtitle } : null,
            ...section.paragraphs.map(p => ({ tag: 'p', text: p }))
        ]).filter(Boolean)  // Remove null elements
    ];

    let elementIndex = 0;
    let charIndex = 0;
    const initialDelay = 50; // Initial delay between characters (in milliseconds)
    const minDelay = 5; // Minimum delay (fastest typing speed)
    const accelerationFactor = 0.99; // Adjust this to control how quickly typing accelerates

    function typeElement() {
        if (elementIndex >= elements.length) {
            highlightKeywords(keywords);  // Add this line
            return;
        }

        const { tag, text } = elements[elementIndex];
        
        if (charIndex === 0) {
            const newElement = document.createElement(tag);
            articleContent.appendChild(newElement);
        }

        const currentElement = articleContent.lastElementChild;
        currentElement.textContent += text[charIndex];
        charIndex++;

        if (charIndex < text.length) {
            let currentDelay = Math.max(initialDelay * Math.pow(accelerationFactor, charIndex), minDelay);
            setTimeout(typeElement, currentDelay);
        } else {
            elementIndex++;
            charIndex = 0;
            setTimeout(typeElement, initialDelay * 10); // Longer pause between elements
        }
    }

    typeElement();
}

function highlightKeywords(keywords) {
    if (!keywords || keywords.length === 0) return;

    const articleContent = document.getElementById('articleContent');
    const html = articleContent.innerHTML;
    const highlightedHtml = keywords.reduce((acc, keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        return acc.replace(regex, `<span class="keyword-highlight">$&</span>`);
    }, html);

    articleContent.innerHTML = highlightedHtml;
}

// Copy text functionality
document.getElementById('copyButton').addEventListener('click', function() {
    const textToCopy = document.getElementById('articleContent').innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Text copied to clipboard');
    }).catch((err) => {
        console.error('Failed to copy text: ', err);
    });
});