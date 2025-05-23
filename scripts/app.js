// Main application logic
class PublicDomainApp {
    constructor() {
        this.resultContainer = null;
    }

    init() {
        this.resultContainer = document.getElementById('book-result');
        
        // Initialize search functionality
        bookSearch.init();
        
        // Set up book selection callback
        bookSearch.setBookSelectedCallback((book) => {
            this.displayBookResult(book);
        });

        console.log('Public Domain Book Checker initialized');
    }

    displayBookResult(book) {
        if (!this.resultContainer) return;

        const publicDomainInfo = this.analyzePublicDomainStatus(book);
        
        const html = `
            <h2 class="book-title">${this.escapeHtml(book.title)}</h2>
            <p class="book-author">by ${this.escapeHtml(book.authors.join(', '))}</p>
            
            ${book.publishYear ? `<p><strong>First Published:</strong> ${book.publishYear}</p>` : ''}
            
            <div class="public-domain-status ${publicDomainInfo.cssClass}">
                <strong>Public Domain Status:</strong> ${publicDomainInfo.status}
            </div>
            
            <div class="book-details">
                <h3>Details</h3>
                <p>${publicDomainInfo.explanation}</p>
                
                ${publicDomainInfo.additionalInfo ? `<p><em>${publicDomainInfo.additionalInfo}</em></p>` : ''}
            </div>
        `;

        this.resultContainer.innerHTML = html;
        this.resultContainer.classList.remove('hidden');
        
        // Scroll to results
        this.resultContainer.scrollIntoView({ behavior: 'smooth' });
    }

    analyzePublicDomainStatus(book) {
        const publishYear = book.publishYear;
        
        if (!publishYear) {
            return {
                status: 'Unknown',
                cssClass: 'status-unknown',
                explanation: 'The publication date for this book could not be determined, so its public domain status is unclear.',
                additionalInfo: 'You may need to research this book manually to determine its copyright status.'
            };
        }

        if (publishYear < 1929) {
            return {
                status: 'Public Domain',
                cssClass: 'status-public-domain',
                explanation: 'This book is in the public domain in the United States because it was published before 1929.',
                additionalInfo: 'You can freely use, copy, and distribute this work.'
            };
        }

        if (publishYear >= 1929 && publishYear <= 1977) {
            return {
                status: 'Possibly Copyrighted',
                cssClass: 'status-unknown',
                explanation: 'Books published between 1929-1977 may be in the public domain if their copyright was not renewed. This requires additional research.',
                additionalInfo: 'Check the U.S. Copyright Office renewal records or consult a legal expert for certainty.'
            };
        }

        // Published after 1977
        return {
            status: 'Likely Copyrighted',
            cssClass: 'status-copyrighted',
            explanation: 'This book was published after 1977 and is likely still under copyright protection in the United States.',
            additionalInfo: 'Most works published after 1977 remain copyrighted for the life of the author plus 70 years, or 95 years for corporate works.'
        };
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new PublicDomainApp();
    app.init();
});