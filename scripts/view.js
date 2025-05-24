/**
 * Public Domain Status Checker
 * Fetches book information and determines public domain status
 */
class PublicDomainView {
    constructor() {
        // Cache DOM elements for better performance
        this.elements = {};
        this.cacheElements();
        
        // Parse URL parameters
        const params = new URLSearchParams(window.location.search);
        this.title = params.get('title');
        
        // Initialize state
        this.publicDomainStatus = {
            status: null,
            description: null
        };
        this.publicationDate = null;
        this.author = null;
        this.description = null;
        this.thumbnail = null;
        
        // Bind methods to preserve context
        this.handleImageError = this.handleImageError.bind(this);
        this.handleImageLoad = this.handleImageLoad.bind(this);
    }

    /**
     * Cache DOM elements to avoid repeated queries
     */
    cacheElements() {
        const elementIds = [
            'placeholder', 
            'book-display', 
            'thumbnail', 
            'title', 
            'author',
            'publication-date', 
            'status-title', 
            'status-description', 
            'description',
            'loading-spinner',
            'error-message'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.showLoadingState();
            await this.getData();
            this.testPublicDomainStatus();
            this.populatePageData();
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Show loading state with accessibility support
     */
    showLoadingState() {
        if (this.elements['loading-spinner']) {
            this.elements['loading-spinner'].classList.remove('hidden');
        }
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        if (this.elements['loading-spinner']) {
            this.elements['loading-spinner'].classList.add('hidden');
        }
    }

    /**
     * Handle and display errors gracefully
     */
    handleError(error) {
        console.error('Application error:', error);
        
        this.hideLoadingState();
        
        if (this.elements['error-message']) {
            this.elements['error-message'].textContent = 'Sorry, we encountered an error loading the book information. Please try again later.';
            this.elements['error-message'].classList.remove('hidden');
            this.elements['error-message'].setAttribute('role', 'alert');
            this.elements['error-message'].setAttribute('aria-live', 'assertive');
        }
        
        if (this.elements.placeholder) {
            this.elements.placeholder.classList.add('hidden');
        }
    }

    /**
     * Populate page with book data and improve accessibility
     */
    populatePageData() {
        if (!this.elements.placeholder || !this.elements['book-display']) {
            throw new Error('Required DOM elements not found');
        }

        this.hideLoadingState();
        this.elements.placeholder.classList.add('hidden');

        // Set image with proper error handling and accessibility
        if (this.elements.thumbnail && this.thumbnail) {
            this.elements.thumbnail.src = this.thumbnail;
            this.elements.thumbnail.alt = `Cover of ${this.title} by ${this.author || 'Unknown Author'}`;
            this.elements.thumbnail.loading = 'lazy'; // Native lazy loading
            this.elements.thumbnail.addEventListener('error', this.handleImageError);
            this.elements.thumbnail.addEventListener('load', this.handleImageLoad);
        }

        // Use textContent for security (prevents XSS) and better performance
        if (this.elements.title) {
            this.elements.title.textContent = this.title || 'Unknown Title';
        }

        if (this.elements.author) {
            this.elements.author.textContent = this.author || 'Unknown Author';
        }

        if (this.elements['publication-date']) {
            this.elements['publication-date'].textContent = this.publicationDate || 'Year Unknown';
        }

        if (this.elements['status-title']) {
            this.elements['status-title'].textContent = this.publicDomainStatus.status || 'Unknown Status';
            switch(this.publicDomainStatus.status) {
                case 'Public Domain':
                    this.elements['status-title'].classList.add('status-public-domain');
                    break;
                case 'Unknown':
                    this.elements['status-title'].classList.add('status-unknown');
                    this.elements['description'].classList.add('hidden');
                    break;
                case 'Likely Copyrighted':
                    this.elements['status-title'].classList.add('status-likely-copyright');
                    break;
                case 'Copyrighted':
                    this.elements['status-title'].classList.add('status-copyright');
                    break;
            };
        }

        if (this.elements['status-description']) {
            this.elements['status-description'].textContent = this.publicDomainStatus.description || 'Status information unavailable';
        }

        // For description, safely handle HTML content
        if (this.elements.description && this.description) {
            // Create a temporary element to sanitize HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.description;
            
            // Remove potentially dangerous elements and attributes
            this.sanitizeHTML(tempDiv);
            
            this.elements.description.innerHTML = tempDiv.innerHTML;
        }

        // Add proper ARIA labels and semantic meaning
        if (this.elements['book-display']) {
            this.elements['book-display'].setAttribute('role', 'main');
            this.elements['book-display'].setAttribute('aria-label', `Information about ${this.title}`);
            this.elements['book-display'].classList.remove('hidden');
        }

        // Update document title for SEO
        document.title = `${this.title} - Public Domain Status | Book Copyright Checker`;
        
        // Update meta description for SEO
        this.updateMetaDescription();
    }

    /**
     * Basic HTML sanitization to prevent XSS
     */
    sanitizeHTML(element) {
        const allowedTags = ['p', 'br', 'strong', 'em', 'i', 'b'];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );

        const nodesToRemove = [];
        let node = walker.nextNode();

        while (node) {
            if (!allowedTags.includes(node.tagName.toLowerCase())) {
                nodesToRemove.push(node);
            } else {
                // Remove all attributes from allowed tags
                Array.from(node.attributes).forEach(attr => {
                    node.removeAttribute(attr.name);
                });
            }
            node = walker.nextNode();
        }

        nodesToRemove.forEach(node => {
            if (node.parentNode) {
                // Replace with text content to preserve information
                const textNode = document.createTextNode(node.textContent);
                node.parentNode.replaceChild(textNode, node);
            }
        });
    }

    /**
     * Update meta description for better SEO
     */
    updateMetaDescription() {
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.name = 'description';
            document.head.appendChild(metaDescription);
        }
        
        const status = this.publicDomainStatus.status || 'Unknown';
        const author = this.author || 'Unknown Author';
        metaDescription.content = `Check if "${this.title}" by ${author} is in the public domain. Current status: ${status}. Free copyright information for books and literature.`;
    }

    /**
     * Handle image loading errors gracefully
     */
    handleImageError() {
        if (this.elements.thumbnail) {
            this.elements.thumbnail.style.display = 'none';
            console.warn('Failed to load book thumbnail');
        }
    }

    /**
     * Handle successful image loading
     */
    handleImageLoad() {
        if (this.elements.thumbnail) {
            this.elements.thumbnail.style.opacity = '1';
        }
    }

    /**
     * Determine public domain status with improved logic
     */
    testPublicDomainStatus() {
        const currentYear = new Date().getFullYear();
        const cutoffYear = currentYear - 95;
        const exceptionYear = 1977;

        if (!this.publicationDate) {
            this.publicDomainStatus.status = 'Unknown';
            this.publicDomainStatus.description = `Not enough information is available about "${this.title}" to determine its copyright status.`;
            return;
        }

        if (this.publicationDate < cutoffYear) {
            this.publicDomainStatus.status = 'Public Domain';
            this.publicDomainStatus.description = `"${this.title}" is in the public domain as it was published before ${cutoffYear}.`;
        } else if (this.publicationDate <= exceptionYear) {
            this.publicDomainStatus.status = 'Likely Copyrighted';
            this.publicDomainStatus.description = `"${this.title}" is likely copyrighted until 95 years after its initial publication, but there might be exceptions.`;
        } else {
            this.publicDomainStatus.status = 'Copyrighted';
            this.publicDomainStatus.description = `With few exceptions, "${this.title}" is most likely copyrighted.`;
        }
    }

    /**
     * Fetch and process book data
     */
    async getData() {
        const bookData = await this.fetchBook();
        if (bookData) {
            const [publicationDate, author, description, thumbnail] = bookData;
            this.author = author;
            this.publicationDate = publicationDate;
            this.description = description;
            this.thumbnail = thumbnail;
        }
    }

    /**
     * Fetch book information from Wikipedia API with better error handling
     */
    async fetchBook() {
        if (!this.title?.trim()) {
            throw new Error('No book title provided');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(this.title.trim())}`;
            
            const response = await fetch(apiUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'PublicDomainChecker/1.0'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Book "${this.title}" not found in Wikipedia`);
                }
                throw new Error(`Wikipedia API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response from Wikipedia API');
            }

            const [publicationDate, author] = this.parsePublicationData(data.description || '');
            const thumbnail = data.thumbnail?.source || null;
            const description = data.extract_html || data.extract || null;

            return [publicationDate, author, description, thumbnail];

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please check your internet connection and try again.');
            }
            
            console.error('Wikipedia query failed:', error);
            throw error;
        }
    }

    /**
     * Parse publication data with improved regex and error handling
     */
    parsePublicationData(description) {
        if (!description || typeof description !== 'string') {
            return [null, null];
        }

        // More comprehensive regex to catch various date formats
        const patterns = [
            /(?:published|written|created).*?(\d{4}).*?by\s+(.+?)(?:\.|,|;|$)/i,
            /(\d{4}).*?by\s+(.+?)(?:\.|,|;|$)/i,
            /by\s+(.+?).*?(\d{4})/i
        ];

        for (const pattern of patterns) {
            const matches = description.match(pattern);
            if (matches) {
                const year = parseInt(matches[1], 10);
                const author = matches[2]?.trim();
                
                // Validate year is reasonable (between 1000-current year)
                const currentYear = new Date().getFullYear();
                if (year >= 1000 && year <= currentYear && author) {
                    return [year, author];
                }
            }
        }

        return [null, null];
    }
}

// Enhanced initialization with better error handling
(() => {
    'use strict';
    
    /**
     * Initialize application when DOM is ready
     */
    function initializeApp() {
        try {
            const app = new PublicDomainView();
            app.init();
        } catch (error) {
            console.error('Failed to initialize Public Domain View:', error);
            
            // Show user-friendly error message
            const errorElement = document.getElementById('error-message');
            if (errorElement) {
                errorElement.textContent = 'Application failed to initialize. Please refresh the page.';
                errorElement.classList.remove('hidden');
                errorElement.setAttribute('role', 'alert');
            }
        }
    }

    // Use more robust DOM ready detection
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOM is already ready
        initializeApp();
    }
})();