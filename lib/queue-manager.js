// Queue management for bulk operations
class QueueManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.concurrency = 3;
    this.currentBatch = [];
  }

  addBatch(items) {
    this.queue.push(...items);
    console.log(`Added ${items.length} items to queue. Total: ${this.queue.length}`);
  }

  async start() {
    if (this.isProcessing) {
      console.log('Queue already processing');
      return;
    }

    this.isProcessing = true;
    console.log(`Starting queue processing: ${this.queue.length} items`);

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      this.currentBatch = batch;

      await Promise.all(batch.map(item => this.processItem(item)));

      // Delay between batches
      if (this.queue.length > 0) {
        await this.sleep(5000);
      }
    }

    this.isProcessing = false;
    console.log('Queue processing complete');
  }

  async processItem(item) {
    // Send to background for processing
    return chrome.runtime.sendMessage({
      action: 'startRankingCheck',
      data: item
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.queue = [];
    this.isProcessing = false;
    console.log('Queue stopped');
  }

  getProgress() {
    return {
      total: this.queue.length + this.currentBatch.length,
      remaining: this.queue.length,
      processing: this.currentBatch.length
    };
  }
}
