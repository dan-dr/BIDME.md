# BidMe: Automated README Banner Bidding System

## Overview

BidMe is an open-source platform that automates the process of bidding for banner space in GitHub repository README files. The system leverages GitHub Actions, GitHub Pages, and Polar.sh to create a seamless bidding experience where advertisers can bid for banner space, and repository owners can approve bids and automatically receive payments.

## Key Features

1. **Automated Bidding Process**: Bids open weekly/monthly as GitHub PRs
2. **PR-Based Bidding**: Bids submitted as PR comments in a specific format
3. **Payment Integration**: Polar.sh handles payment processing
4. **Owner Approval**: Repository owners approve/reject bids with emoji reactions
5. **Analytics**: View counts and country distribution shown as badges
6. **Easy Deployment**: Copy-paste installation for any GitHub repository

## System Architecture

The system is built entirely on GitHub infrastructure:

1. **GitHub Actions**: Handle scheduling, bid processing, and README updates
2. **GitHub Pages**: Provides user interface and redirect tracking
3. **Bun Scripts**: Contain core logic, called by GitHub Actions
4. **Polar.sh**: Handles payment processing as a merchant of record

## Core Components

### 1. GitHub Actions Workflows

#### a. Bid Opening Workflow

- Triggered on schedule (weekly/monthly)
- Creates a new PR for the bidding period
- Updates PR description with current highest bid

#### b. Bid Processing Workflow

- Triggered on PR comment
- Validates bid format and bidder registration
- Updates PR description with new highest bid if applicable

#### c. Bid Closing Workflow

- Triggered at end of bidding period
- Selects highest approved bid
- Processes payment through Polar.sh
- Updates README with winning banner
- Closes bidding PR and creates a record

#### d. Bid Approval Workflow

- Triggered on emoji reaction to bid comment
- Marks bid as approved/rejected based on emoji
- Updates PR description with current highest approved bid

### 2. Bid Format (in PR comments)

```
---
bid: 100
banner_url: https://example.com/banner.png
destination_url: https://example.com
contact: email@example.com
---

Optional message to the repository owner.
```

### 3. Configuration File (bidme-config.yml)

```yaml
bidding:
  schedule: "monthly" # or "weekly"
  duration: 7 # days
  minimum_bid: 50 # USD
  increment: 5 # minimum bid increment

banner:
  width: 800
  height: 100
  format: "png,jpg,svg"
  max_size: 200 # KB
  position: "top" # or "bottom"

content_guidelines:
  prohibited: ["adult content", "gambling", "misleading claims"]
  required: ["alt text", "clear branding"]

analytics:
  display: true
  metrics:
    - views
    - countries
    - referrers
    - clicks
```

## Analytics Implementation

### GitHub-Compatible Analytics

BidMe implements a fully GitHub-compatible analytics system without requiring external servers:

1. **View Tracking**: Combination of GitHub Traffic API and redirect tracking
2. **Data Storage**: Repository data files for analytics metrics
3. **Badge Generation**: Dynamic shields.io badges showing key metrics
4. **Privacy-Focused**: Only anonymous, aggregated data is collected

### Analytics Workflow

1. **GitHub Traffic API + Actions**:

   - Scheduled GitHub Action fetches repository traffic data
   - Processes and stores analytics in repository files
   - Updates badges with current metrics

2. **Redirect Tracking with Referral Parameter**:

   - Banner links point to GitHub Pages redirect:
     `https://owner.github.io/repo/redirect?id=banner123&dest=https://destination.com`
   - Redirect page adds `ref=repoowner/name` to destination URL
   - Logs interaction data in repository
   - Redirects user to destination with referral parameter

3. **Analytics Badges in README**:

```markdown
![Banner for Awesome Product](https://example.com/banner.png)

[![Views: 1.2k](https://img.shields.io/badge/Views-1.2k-blue)]()
[![Countries: 42](https://img.shields.io/badge/Countries-42-green)]()
[![CTR: 3.5%](https://img.shields.io/badge/CTR-3.5%25-orange)]()
```

## Payment Integration with Polar.sh

Polar.sh serves as the payment processor and merchant of record:

1. **No Stored Payment Details**: BidMe never stores payment information
2. **Delegated Payment Processing**: All payment handling is done by Polar.sh
3. **GitHub Secrets**: Any required API keys stored as GitHub repository secrets

## Deployable Structure

```
bidme/
├── .github/
│   └── workflows/
│       ├── schedule-bidding.yml
│       ├── process-bid.yml
│       ├── close-bidding.yml
│       └── process-approval.yml
├── scripts/
│   ├── bid-opener.ts
│   ├── bid-processor.ts
│   ├── bid-closer.ts
│   ├── analytics-updater.ts
│   └── utils/
│       ├── github-api.ts
│       ├── polar-integration.ts
│       ├── badge-generator.ts
│       └── validation.ts
├── pages/
│   ├── index.html
│   ├── dashboard.html
│   ├── admin.html
│   └── assets/
│       ├── css/
│       └── js/
├── bidme-config.yml
└── README.md
```

## Implementation Plan

1. **Phase 1**: Core Infrastructure

   - Repository structure
   - Configuration files
   - Basic GitHub Actions workflows

2. **Phase 2**: Bidding System

   - Bid submission and validation
   - Approval mechanism
   - Winner selection logic

3. **Phase 3**: Payment Integration

   - Polar.sh integration
   - Payment status tracking

4. **Phase 4**: Analytics System

   - GitHub Traffic API integration
   - Redirect tracking implementation
   - Badge generation

5. **Phase 5**: Testing and Documentation
   - End-to-end testing
   - Documentation for easy adoption
