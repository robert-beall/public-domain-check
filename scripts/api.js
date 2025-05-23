// API service layer for book data
class BookAPI {
    constructor() {
        this.cache = new Map();
        this.currentController = null;
    }

    // Search for books using multiple sources with data validation
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
            // Search multiple sources and combine results
            const [gutenbergResults, openLibraryResults] = await Promise.allSettled([
                this.searchProjectGutenberg(query),
                this.searchOpenLibraryFiltered(query, limit)
            ]);

            let books = [];

            // Add Project Gutenberg results first (they're most reliable)
            if (gutenbergResults.status === 'fulfilled') {
                books.push(...gutenbergResults.value);
            }

            // Add filtered Open Library results
            if (openLibraryResults.status === 'fulfilled') {
                books.push(...openLibraryResults.value);
            }

            // Remove duplicates and limit results
            books = this.deduplicateBooks(books).slice(0, limit);

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

    // Search Project Gutenberg (most reliable for public domain books)
    async searchProjectGutenberg(query) {
        try {
            // Project Gutenberg search endpoint
            const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
            
            const response = await fetch(url, {
                signal: this.currentController.signal
            });

            if (!response.ok) {
                throw new Error(`Gutenberg API error: ${response.status}`);
            }

            const data = await response.json();
            return this.processGutenbergResults(data);
        } catch (error) {
            console.warn('Project Gutenberg search failed:', error);
            return [];
        }
    }

    // Search Open Library with better filtering
    async searchOpenLibraryFiltered(query, limit) {
        try {
            const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit * 2}&fields=key,title,author_name,first_publish_year,publish_year,publish_date,subject`;
            
            const response = await fetch(url, {
                signal: this.currentController.signal
            });

            if (!response.ok) {
                throw new Error(`Open Library API error: ${response.status}`);
            }

            const data = await response.json();
            return this.processOpenLibraryResultsFiltered(data);
        } catch (error) {
            console.warn('Open Library search failed:', error);
            return [];
        }
    }

    // Process Project Gutenberg results (most reliable)
    processGutenbergResults(data) {
        console.log({data});
        if (!data.results || !Array.isArray(data.results)) {
            return [];
        }

        return data.results.map(book => ({
            id: `gutenberg_${book.id}`,
            title: book.title || 'Unknown Title',
            authors: book.authors?.map(author => author.name) || ['Unknown Author'],
            publishYear: this.extractYearFromGutenberg(book),
            source: 'gutenberg',
            reliability: 'high', // Gutenberg data is very reliable
            isPublicDomain: true // All Gutenberg books are public domain
        }));
    }

    // Extract publication year from Gutenberg data
    extractYearFromGutenberg(book) {
        // Gutenberg doesn't always have exact publication dates, but we can infer
        // from death dates and other metadata
        if (book.authors && book.authors.length > 0) {
            const author = book.authors[0];
            if (author.death_year) {
                // If author died before 1929, the book is definitely public domain
                // We can estimate publication year as before death year
                return author.death_year < 1929 ? author.death_year - 10 : null;
            }
        }
        
        // For now, return null - we know it's public domain from Gutenberg
        return null;
    }

    // Process Open Library results with better filtering
    processOpenLibraryResultsFiltered(data) {
        if (!data.docs || !Array.isArray(data.docs)) {
            return [];
        }

        return data.docs
            .map(book => ({
                id: book.key,
                title: book.title || 'Unknown Title',
                authors: book.author_name || ['Unknown Author'],
                publishYear: this.getValidatedYear(book),
                source: 'openlibrary',
                reliability: this.assessDataReliability(book),
                rawData: book // Keep for debugging
            }))
            .filter(book => book.reliability !== 'invalid') // Filter out obviously bad data
            .sort((a, b) => {
                // Sort by reliability, then by title match
                if (a.reliability !== b.reliability) {
                    const reliabilityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                    return reliabilityOrder[b.reliability] - reliabilityOrder[a.reliability];
                }
                return 0;
            });
    }

    // Get validated publication year with data quality checks
    getValidatedYear(book) {
        const firstYear = book.first_publish_year;
        const publishYears = book.publish_year;
        
        let candidates = [];
        
        if (firstYear && this.isValidYear(firstYear)) {
            candidates.push(firstYear);
        }
        
        if (publishYears && Array.isArray(publishYears)) {
            const validYears = publishYears.filter(year => this.isValidYear(year));
            candidates.push(...validYears);
        }
        
        if (candidates.length === 0) {
            return null;
        }
        
        // Return the earliest valid year
        const earliest = Math.min(...candidates);
        
        // Additional validation: if the earliest year seems wrong, try to correct it
        return this.validateYearAgainstContext(earliest, book);
    }

    // Check if a year seems valid
    isValidYear(year) {
        const currentYear = new Date().getFullYear();
        
        // Basic range check
        if (!year || year < 1000 || year > currentYear) {
            return false;
        }
        
        // Flag obviously wrong dates
        if (year < 1400) { // Before printing press
            return false;
        }
        
        return true;
    }

    // Validate year against book context and known issues
    validateYearAgainstContext(year, book) {
        const title = (book.title || '').toLowerCase();
        const authors = book.author_name || [];
        
        // Known problematic patterns in Open Library data
        const suspiciousPatterns = [
            { pattern: /cthulhu|lovecraft/, minYear: 1890, maxYear: 1937 },
            { pattern: /hardy|tess.*urbervilles/, minYear: 1840, maxYear: 1928 },
            { pattern: /dickens/, minYear: 1812, maxYear: 1870 },
            { pattern: /shakespeare/, minYear: 1564, maxYear: 1616 },
            { pattern: /austen/, minYear: 1775, maxYear: 1817 }
        ];
        
        for (const check of suspiciousPatterns) {
            if (check.pattern.test(title) || authors.some(author => check.pattern.test(author.toLowerCase()))) {
                if (year < check.minYear || year > check.maxYear) {
                    console.warn(`Suspicious year ${year} for ${title} - likely data error`);
                    return null; // Return null for obviously wrong dates
                }
            }
        }
        
        return year;
    }

    // Assess the reliability of Open Library data
    assessDataReliability(book) {
        let score = 0;
        
        // Check if title exists and seems reasonable
        if (book.title && book.title.length > 1 && book.title !== 'Unknown Title') {
            score += 2;
        }
        
        // Check if authors exist
        if (book.author_name && book.author_name.length > 0) {
            score += 2;
        }
        
        // Check if publication year seems valid
        if (this.getValidatedYear(book)) {
            score += 3;
        }
        
        // Penalty for suspicious patterns
        const title = (book.title || '').toLowerCase();
        if (title.includes('unknown') || title.length < 3) {
            score -= 2;
        }
        
        // Return reliability category
        if (score >= 5) return 'high';
        if (score >= 3) return 'medium';
        if (score >= 1) return 'low';
        return 'invalid';
    }

    // Remove duplicate books from combined results
    deduplicateBooks(books) {
        const seen = new Map();
        const result = [];
        
        for (const book of books) {
            // Create a normalized key for comparison
            const normalizedTitle = book.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
            const normalizedAuthor = book.authors[0]?.toLowerCase().replace(/[^\w\s]/g, '').trim() || '';
            const key = `${normalizedTitle}_${normalizedAuthor}`;
            
            if (!seen.has(key)) {
                seen.set(key, true);
                result.push(book);
            } else {
                // If we have a duplicate, prefer the one with higher reliability
                const existingIndex = result.findIndex(existing => {
                    const existingKey = `${existing.title.toLowerCase().replace(/[^\w\s]/g, '').trim()}_${existing.authors[0]?.toLowerCase().replace(/[^\w\s]/g, '').trim() || ''}`;
                    return existingKey === key;
                });
                
                if (existingIndex >= 0 && book.reliability === 'high' && result[existingIndex].reliability !== 'high') {
                    result[existingIndex] = book; // Replace with more reliable version
                }
            }
        }
        
        return result;
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