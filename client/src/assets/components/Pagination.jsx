import React from 'react';

/**
 * Global Reusable Table Pagination Component for Admin Dashboard
 * Supports:
 * - Default page size: 10
 * - Selectable page sizes: 10, 25, 50, 100
 * - Previous / Next buttons, numbered page buttons with smart ellipsis
 * - Current page indicator & Total record count
 * - Disabled states when loading or at boundaries
 */
const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  pageSize,
  rowsPerPage,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  onRowsPerPageChange,
  loading = false,
  itemLabel = 'records'
}) => {
  const safeCurrentPage = Math.max(1, Number(currentPage) || 1);
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeTotalRecords = Math.max(0, Number(totalRecords) || 0);
  const safePageSize = Number(pageSize ?? rowsPerPage) || 10;
  const handleSizeChangeCallback = onPageSizeChange || onRowsPerPageChange;

  const startRecord = safeTotalRecords === 0 ? 0 : (safeCurrentPage - 1) * safePageSize + 1;
  const endRecord = Math.min(safeTotalRecords, safeCurrentPage * safePageSize);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (safeTotalPages <= maxVisible + 2) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    pages.push(1);

    let start = Math.max(2, safeCurrentPage - 1);
    let end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

    if (safeCurrentPage <= 3) {
      start = 2;
      end = 4;
    } else if (safeCurrentPage >= safeTotalPages - 2) {
      start = safeTotalPages - 3;
      end = safeTotalPages - 1;
    }

    if (start > 2) {
      pages.push('ellipsis-left');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < safeTotalPages - 1) {
      pages.push('ellipsis-right');
    }

    pages.push(safeTotalPages);
    return pages;
  };

  const handlePageSelect = (targetPage) => {
    if (loading || !onPageChange) return;
    if (targetPage < 1 || targetPage > safeTotalPages || targetPage === safeCurrentPage) return;
    onPageChange(targetPage);
  };

  const handleSizeSelect = (e) => {
    if (loading || !handleSizeChangeCallback) return;
    const nextSize = Number(e.target.value) || 10;
    handleSizeChangeCallback(nextSize);
  };

  const pageItems = getPageNumbers();

  return (
    <div className="admin-global-pagination" aria-label="Table Pagination">
      <div className="admin-global-pagination-info">
        <span className="pagination-summary-text">
          Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
          <strong>{safeTotalRecords.toLocaleString()}</strong> {itemLabel}
        </span>
        <span className="pagination-divider">•</span>
        <span className="pagination-page-indicator">
          Page <strong>{safeCurrentPage}</strong> of <strong>{safeTotalPages}</strong>
        </span>
      </div>

      <div className="admin-global-pagination-controls">
        {handleSizeChangeCallback && (
          <div className="pagination-size-selector">
            <label htmlFor="admin-page-size-select">Rows per page:</label>
            <select
              id="admin-page-size-select"
              value={safePageSize}
              onChange={handleSizeSelect}
              disabled={loading}
              className="pagination-size-select"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pagination-buttons-group">
          <button
            type="button"
            className="pagination-nav-btn"
            onClick={() => handlePageSelect(safeCurrentPage - 1)}
            disabled={loading || safeCurrentPage <= 1}
            title="Previous Page"
          >
            <i className="fa-solid fa-chevron-left"></i>
            <span>Previous</span>
          </button>

          <div className="pagination-numbers">
            {pageItems.map((item) => {
              if (typeof item === 'string') {
                return (
                  <span key={item} className="pagination-ellipsis">
                    …
                  </span>
                );
              }
              const isActive = item === safeCurrentPage;
              return (
                <button
                  key={item}
                  type="button"
                  className={`pagination-num-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handlePageSelect(item)}
                  disabled={loading}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="pagination-nav-btn"
            onClick={() => handlePageSelect(safeCurrentPage + 1)}
            disabled={loading || safeCurrentPage >= safeTotalPages}
            title="Next Page"
          >
            <span>Next</span>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
