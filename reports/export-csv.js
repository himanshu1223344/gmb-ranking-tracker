// CSV Export Utilities
const CSVExporter = {
  
  // Generate CSV from rankings data
  generateRankingsCSV(rankings) {
    const headers = [
      'Business Name',
      'Place ID',
      'Keyword',
      'Location',
      'Organic Position',
      'Page',
      'Confidence (%)',
      'Status',
      'Date Checked'
    ];
    
    const rows = rankings.map(r => [
      this.escapeCSV(r.businessName),
      this.escapeCSV(r.placeId || ''),
      this.escapeCSV(r.keyword),
      this.escapeCSV(r.location || ''),
      r.organicPosition || 'Not Ranked',
      r.page || '',
      r.confidence || '',
      r.status || '',
      new Date(r.timestamp).toLocaleString()
    ]);
    
    return this.arrayToCSV([headers, ...rows]);
  },
  
  // Convert array to CSV string
  arrayToCSV(data) {
    return data.map(row => row.join(',')).join('\n');
  },
  
  // Escape CSV value (handle commas, quotes, newlines)
  escapeCSV(value) {
    if (!value) return '';
    
    const str = String(value);
    
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  },
  
  // Download CSV file to user's computer
  download(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `gmb_rankings_export_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
  
  // Generate template CSV for bulk upload
  generateTemplate() {
    const headers = ['business_name', 'place_id', 'keyword', 'location'];
    const exampleRow = ['Example Business Name', '0x123456789abcdef', 'digital marketing agency', 'Mumbai'];
    const exampleRow2 = ['Another Business', '', 'seo services', 'Delhi'];
    
    return this.arrayToCSV([headers, exampleRow, exampleRow2]);
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSVExporter;
}
