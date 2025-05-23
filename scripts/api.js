// API service layer for book data
class BookAPI {
    constructor() {
        this.cache = new Map();
        this.currentController = null;
    }

    // Search for books using Open Library API
    async searchBooks(query, limit = 10) {
        // Cancel previous request if still pending
        if (this.currentController) {
            this.currentController.abort();
        }

        // Create new abort controller for this request
        this.currentController = new AbortController();

        // Check cache first
        const cacheKey = `search_${query}_${limit}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year,publish_year`;
            
            const response = await fetch(url, {
                signal: this.currentController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const books = this.processOpenLibraryResults(data);

            // Cache the results
            this.cache.set(cacheKey, books);
            
            return books;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Search request was cancelled');
                return [];
            }
            console.error('Error searching books:', error);
            throw error;
        }
    }

    // Process Open Library API results into consistent format
    processOpenLibraryResults(data) {
        if (!data.docs || !Array.isArray(data.docs)) {
            return [];
        }

        return data.docs.map(book => ({
            id: book.key,
            title: book.title || 'Unknown Title',
            authors: book.author_name || ['Unknown Author'],
            publishYear: this.getEarliestYear(book.first_publish_year, book.publish_year),
            source: 'openlibrary'
        }));
    }

    // Get the earliest publication year from available data
    getEarliestYear(firstYear, publishYears) {
        let earliest = firstYear;

        if (publishYears && Array.isArray(publishYears)) {
            const minPublishYear = Math.min(...publishYears);
            if (!earliest || minPublishYear < earliest) {
                earliest = minPublishYear;
            }
        }

        return earliest;
    }

    // Get detailed book information (for future expansion)
    async getBookDetails(bookId) {
        const cacheKey = `details_${bookId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://openlibrary.org${bookId}.json`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.cache.set(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Error fetching book details:', error);
            throw error;
        }
    }

    // Clear cache (useful for development)
    clearCache() {
        this.cache.clear();
    }
}

// Create global instance
const bookAPI = new BookAPI();