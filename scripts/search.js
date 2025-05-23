// Search functionality with fuzzy matching and suggestions
class BookSearch {
    constructor() {
        this.searchInput = null;
        this.suggestionsContainer = null;
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        this.searchTimeout = null;
        this.onBookSelected = null;
    }

    init() {
        this.searchInput = document.getElementById('book-search');
        this.suggestionsContainer = document.getElementById('search-suggestions');
        
        if (!this.searchInput || !this.suggestionsContainer) {
            console.error('Required search elements not found');
            return;
        }

        this.bindEvents();
    }

    bindEvents() {
        // Search input events
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });

        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        this.searchInput.addEventListener('focus', () => {
            if (this.currentSuggestions.length > 0) {
                this.showSuggestions();
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.suggestionsContainer.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    handleSearchInput(query) {
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Reset selection
        this.selectedIndex = -1;

        // Hide suggestions if query is too short
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }

        // Debounce the search
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300);
    }

    async performSearch(query) {
        try {
            this.setLoadingState(true);
            const books = await bookAPI.searchBooks(query);
            
            // Apply fuzzy matching for better results
            const filteredBooks = this.applyFuzzyFilter(books, query);
            
            this.displaySuggestions(filteredBooks);
        } catch (error) {
            console.error('Search failed:', error);
            this.displayError('Search failed. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    applyFuzzyFilter(books, query) {
        return books
            .map(book => ({
                ...book,
                score: this.calculateMatchScore(book, query)
            }))
            .filter(book => book.score > 30) // Minimum score threshold
            .sort((a, b) => b.score - a.score)
            .slice(0, 8); // Limit to top 8 results
    }

    calculateMatchScore(book, query) {
        const queryLower = query.toLowerCase();
        const titleScore = this.fuzzyMatch(queryLower, book.title.toLowerCase()) * 2; // Title weighted higher
        
        let authorScore = 0;
        if (book.authors && book.authors.length > 0) {
            authorScore = Math.max(...book.authors.map(author => 
                this.fuzzyMatch(queryLower, author.toLowerCase())
            ));
        }

        return Math.max(titleScore, authorScore);
    }

    fuzzyMatch(needle, haystack) {
        // Exact substring match gets highest score
        if (haystack.includes(needle)) {
            return 100;
        }

        // Character-by-character fuzzy matching
        let score = 0;
        let needleIndex = 0;
        
        for (let i = 0; i < haystack.length && needleIndex < needle.length; i++) {
            if (haystack[i] === needle[needleIndex]) {
                score++;
                needleIndex++;
            }
        }

        return (score / needle.length) * 100;
    }

    displaySuggestions(books) {
        this.currentSuggestions = books;
        
        if (books.length === 0) {
            this.displayNoResults();
            return;
        }

        const html = books.map((book, index) => `
            <div class="suggestion-item" data-index="${index}">
                <div class="suggestion-title">${this.escapeHtml(book.title)}</div>
                <div class="suggestion-author">by ${this.escapeHtml(book.authors.join(', '))}</div>
                ${book.publishYear ? `<div class="suggestion-year">${book.publishYear}</div>` : ''}
            </div>
        `).join('');

        this.suggestionsContainer.innerHTML = html;
        this.bindSuggestionEvents();
        this.showSuggestions();
    }

    displayNoResults() {
        this.suggestionsContainer.innerHTML = `
            <div class="suggestion-item">
                <div class="suggestion-title">No books found</div>
                <div class="suggestion-author">Try a different search term</div>
            </div>
        `;
        this.showSuggestions();
    }

    displayError(message) {
        this.suggestionsContainer.innerHTML = `
            <div class="suggestion-item">
                <div class="suggestion-title" style="color: #dc3545;">${message}</div>
            </div>
        `;
        this.showSuggestions();
    }

    bindSuggestionEvents() {
        const suggestionItems = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        
        suggestionItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectSuggestion(index);
            });

            item.addEventListener('mouseenter', () => {
                this.highlightSuggestion(index);
            });
        });
    }

    handleKeyDown(e) {
        const suggestionItems = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, suggestionItems.length - 1);
                this.highlightSuggestion(this.selectedIndex);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.highlightSuggestion(this.selectedIndex);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.currentSuggestions[this.selectedIndex]) {
                    this.selectSuggestion(this.selectedIndex);
                }
                break;
                
            case 'Escape':
                this.hideSuggestions();
                this.searchInput.blur();
                break;
        }
    }

    highlightSuggestion(index) {
        const suggestionItems = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        
        suggestionItems.forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });
        
        this.selectedIndex = index;
    }

    selectSuggestion(index) {
        const book = this.currentSuggestions[index];
        if (!book) return;

        // Update search input
        this.searchInput.value = book.title;
        
        // Hide suggestions
        this.hideSuggestions();
        
        // Notify that a book was selected
        if (this.onBookSelected) {
            this.onBookSelected(book);
        }
    }

    showSuggestions() {
        this.suggestionsContainer.classList.remove('hidden');
    }

    hideSuggestions() {
        this.suggestionsContainer.classList.add('hidden');
        this.selectedIndex = -1;
    }

    setLoadingState(loading) {
        this.searchInput.classList.toggle('loading', loading);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Set callback for when a book is selected
    setBookSelectedCallback(callback) {
        this.onBookSelected = callback;
    }
}

// Create global instance
const bookSearch = new BookSearch();