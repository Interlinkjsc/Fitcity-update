/**
 * Helper to generate pagination metadata
 * @param {number} totalDocs Total number of documents
 * @param {number} page Current page number
 * @param {number} limit Documents per page
 * @returns {object} Pagination object for templates
 */
exports.getPagination = (totalDocs, page, limit) => {
    const totalPages = Math.ceil(totalDocs / limit) || 1;
    const currentPage = parseInt(page) || 1;
    
    return {
        totalDocs,
        limit,
        page: currentPage,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage + 1,
        prevPage: currentPage - 1
    };
};
