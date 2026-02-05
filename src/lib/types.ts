export interface BidRecord {
  bidder: string;
  amount: number;
  banner_url: string;
  destination_url: string;
  contact: string;
  status: "pending" | "approved" | "rejected";
  comment_id: number;
  timestamp: string;
}

export interface PeriodData {
  period_id: string;
  status: "open" | "closed";
  start_date: string;
  end_date: string;
  issue_number: number;
  issue_url: string;
  bids: BidRecord[];
  created_at: string;
  issue_node_id?: string;
  payment?: {
    checkout_url: string;
    payment_status: "pending" | "paid" | "expired";
    product_id?: string;
    checkout_id?: string;
  };
}
