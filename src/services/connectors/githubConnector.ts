/**
 * GitHub Connector
 * 
 * Handles authentication and data syncing with GitHub API
 * Supports PRs, Issues, and Notifications
 */

import type { Account } from '../../types';
import type { GithubItem } from '../database';

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email: string | null;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  body: string | null;
  labels: Array<{
    name: string;
    color: string;
  }>;
  comments: number;
  repository_url: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  body: string | null;
  labels: Array<{
    name: string;
    color: string;
  }>;
  comments: number;
  repository_url: string;
  pull_request?: any; // If exists, it's a PR
}

export interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  subject: {
    title: string;
    url: string;
    type: string;
  };
  repository: {
    full_name: string;
    html_url: string;
  };
}

/**
 * Validate GitHub Personal Access Token
 */
export async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get GitHub user profile
 */
export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub token is invalid or lacks required permissions. Please reconnect your account.');
    }
    if (response.status === 401) {
      throw new Error('GitHub token has expired. Please reconnect your account.');
    }
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Failed to fetch GitHub user: ${error.message}`);
  }

  return response.json();
}

/**
 * Fetch user's pull requests
 */
export async function fetchGitHubPullRequests(token: string, username: string): Promise<GitHubPullRequest[]> {
  const response = await fetch(
    `https://api.github.com/search/issues?q=author:${username}+type:pr+is:open&sort=updated&order=desc&per_page=50`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub token is invalid or lacks required permissions. Please reconnect your account.');
    }
    if (response.status === 401) {
      throw new Error('GitHub token has expired. Please reconnect your account.');
    }
    throw new Error(`Failed to fetch GitHub pull requests: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Fetch user's issues
 */
export async function fetchGitHubIssues(token: string, username: string): Promise<GitHubIssue[]> {
  const response = await fetch(
    `https://api.github.com/search/issues?q=author:${username}+type:issue+is:open&sort=updated&order=desc&per_page=50`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub token is invalid or lacks required permissions. Please reconnect your account.');
    }
    if (response.status === 401) {
      throw new Error('GitHub token has expired. Please reconnect your account.');
    }
    throw new Error(`Failed to fetch GitHub issues: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.items.filter((item: any) => !item.pull_request); // Filter out PRs
}

/**
 * Fetch user's notifications
 */
export async function fetchGitHubNotifications(token: string): Promise<GitHubNotification[]> {
  const response = await fetch(
    'https://api.github.com/notifications?all=false&per_page=100',
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      console.error('GitHub API 403 Forbidden:', errorData);
      throw new Error('GitHub token is invalid or lacks required permissions. Please reconnect your account.');
    }
    if (response.status === 401) {
      throw new Error('GitHub token has expired. Please reconnect your account.');
    }
    throw new Error(`Failed to fetch GitHub notifications: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract repository name from URL
 */
function extractRepoName(url: string): string {
  // URL format: https://api.github.com/repos/owner/repo/...
  const match = url.match(/repos\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : 'Unknown';
}

/**
 * Convert GitHub PR to GithubItem
 */
function prToGithubItem(pr: GitHubPullRequest, accountId: string): GithubItem {
  return {
    id: `github-pr-${pr.id}`,
    accountId: accountId,
    type: 'pr',
    title: pr.title,
    url: pr.html_url,
    repository: extractRepoName(pr.repository_url),
    author: pr.user.login,
    state: pr.state,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    body: pr.body || undefined,
    labels: pr.labels?.map(l => l.name) || [],
    commentsCount: pr.comments || 0,
    isRead: false,
  };
}

/**
 * Convert GitHub Issue to GithubItem
 */
function issueToGithubItem(issue: GitHubIssue, accountId: string): GithubItem {
  return {
    id: `github-issue-${issue.id}`,
    accountId: accountId,
    type: 'issue',
    title: issue.title,
    url: issue.html_url,
    repository: extractRepoName(issue.repository_url),
    author: issue.user.login,
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    body: issue.body || undefined,
    labels: issue.labels?.map(l => l.name) || [],
    commentsCount: issue.comments || 0,
    isRead: false,
  };
}

/**
 * Convert GitHub Notification to GithubItem
 */
function notificationToGithubItem(notif: GitHubNotification, accountId: string): GithubItem {
  return {
    id: `github-notif-${notif.id}`,
    accountId: accountId,
    type: 'notification',
    title: notif.subject.title,
    url: notif.subject.url || notif.repository.html_url,
    repository: notif.repository.full_name,
    author: 'N/A',
    state: notif.unread ? 'unread' : 'read',
    createdAt: notif.updated_at,
    updatedAt: notif.updated_at,
    body: `${notif.reason}: ${notif.subject.type}`,
    labels: [notif.reason, notif.subject.type],
    commentsCount: 0,
    isRead: !notif.unread,
  };
}

/**
 * Connect GitHub account with Personal Access Token
 */
export async function connectGitHubAccount(token: string): Promise<Account> {
  try {
    // Validate token
    const isValid = await validateGitHubToken(token);
    if (!isValid) {
      throw new Error('Invalid GitHub token');
    }

    // Get user info
    const user = await getGitHubUser(token);

    // Create account object
    const account: Account = {
      id: `github-${user.id}`,
      name: user.name || user.login,
      email: user.email || `${user.login}@github.com`,
      platform: 'github',
      category: 'development',
      isConnected: true,
      accessToken: token,
    };

    return account;
  } catch (error) {
    console.error('GitHub connection failed:', error);
    throw error;
  }
}

/**
 * Sync GitHub account data (PRs, Issues, Notifications)
 */
export async function syncGitHubAccount(account: Account): Promise<{
  items: GithubItem[];
}> {
  if (!account.accessToken) {
    throw new Error('No access token available');
  }

  try {
    // Get user info to get username
    const user = await getGitHubUser(account.accessToken);

    // Fetch all data in parallel
    const [prs, issues, notifications] = await Promise.all([
      fetchGitHubPullRequests(account.accessToken, user.login),
      fetchGitHubIssues(account.accessToken, user.login),
      fetchGitHubNotifications(account.accessToken),
    ]);

    // Convert to GithubItems
    const prItems = prs.map(pr => prToGithubItem(pr, account.id));
    const issueItems = issues.map(issue => issueToGithubItem(issue, account.id));
    const notifItems = notifications.map(notif => notificationToGithubItem(notif, account.id));

    const allItems = [...prItems, ...issueItems, ...notifItems];

    // Sort by updated date (newest first)
    allItems.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return { items: allItems };
  } catch (error) {
    console.error('GitHub sync failed:', error);
    throw error;
  }
}

/**
 * Disconnect GitHub account
 */
export async function disconnectGitHubAccount(account: Account): Promise<void> {
  // GitHub Personal Access Tokens can't be revoked programmatically
  // User must manually revoke at https://github.com/settings/tokens
  
  account.accessToken = undefined;
  account.isConnected = false;
}

/**
 * Mark GitHub notification as read
 */
export async function markGitHubNotificationAsRead(token: string, notificationId: string): Promise<void> {
  await fetch(`https://api.github.com/notifications/threads/${notificationId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
}
