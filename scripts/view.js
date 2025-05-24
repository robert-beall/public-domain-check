// View logic
class PublicDomainView {
    constructor() {
        const params = new URLSearchParams(document.location.search)
        this.title = params.get('title');
        this.publicDomainStatus = {
            status: null,
            description: null
        };
        this.publicationDate = null;
        this.author = null;
        this.description = null;
        this.thumbnail = null;
    }

    init() {
        this.getData().then(() => {
            this.testPublicDomainStatus();
        }).then(() => {
            this.populatePageData();
        });
    }

    populatePageData() {
        const placeholder = document.getElementById('placeholder')
        placeholder.classList.add('hidden');
        const bookDisplay = document.getElementById('book-display');
        const thumbnail = document.getElementById('thumbnail');

        thumbnail.setAttribute('src', this.thumbnail);
        const title = document.getElementById('title')
        title.innerHTML = this.title;

        const author = document.getElementById('author');
        author.innerHTML = this.author;

        const statusTitle = document.getElementById('status-title');
        const statusDescription = document.getElementById('status-description');

        statusTitle.innerHTML = this.publicDomainStatus.status;
        statusDescription.innerHTML = this.publicDomainStatus.description;

        const description = document.getElementById('description');
        description.innerHTML =this.description;

        bookDisplay.classList.remove('hidden');
    }

    async testPublicDomainStatus() {
        const currentYear = +(new Date().getFullYear());
        // works published 95+ years ago generally are in public domain
        const cutoffYear = currentYear - 95;
        // works published after this year have different rules applied. 
        const exceptionYear = 1977; 

        if (!this.publicationDate) {
            this.publicDomainStatus = 'unknown';
            this.publicDomainStatus.description = `Not enough information is available about ${this.title} to determine its copyright status.`;
            return;
        }

        if (this.publicationDate < cutoffYear) {
            this.publicDomainStatus.status = 'Public Domain';
            this.publicDomainStatus.description = `${this.title} is in the public domain as it was published before ${cutoffYear}.`;
        } else if(this.publicationDate <= exceptionYear) {
            this.publicDomainStatus.status = 'Likely Copyrighted';
            this.publicDomainStatus.description = `${this.title} is likely copyrighted until 95 years after its initial publication, but there might be exceptions.`;
        } else if(this.publicationDate > exceptionYear) {
            this.publicDomainStatus.status = 'Copyrighted';
            this.publicDomainStatus.description = `With few exceptions, ${this.title} is most likely copyrighted.`;
        }
    }

    async getData() {
        const [publicationDate, author, description, thumbnail] = await Promise.resolve(this.fetchBook());
        this.author = author;
        this.publicationDate = publicationDate;
        this.description = description;
        this.thumbnail = thumbnail;
    }

    async fetchBook() {
        try {
            if (this.title === null) {
                return;
            }

            const authorUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(this.title)}`;

            const response = await fetch(authorUrl);

            if (!response.ok) {
                throw new Error(`Open Library API error: ${response.status}`);    
            }

            const data = await response.json();

            if (typeof data === 'undefined') {
                return;
            }

            return [...this.parsePublicationData(data.description), data.extract_html, data.thumbnail.source];
        } catch(error) {
            console.error('Wikipedia query failed:', error);
        }
    }

    parsePublicationData(description) {
        const pattern = /([0-9]{4}).*by(.*)/g;

        const matches = [...description.matchAll(pattern)];

        const values = matches.shift();

        return [+(values[1]), values[2].trim()];
    }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new PublicDomainView();
    app.init();
});