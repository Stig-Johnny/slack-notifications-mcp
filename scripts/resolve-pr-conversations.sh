#!/bin/bash
set -e

# Resolve PR conversations to unblock auto-merge
# This script checks for and resolves Copilot review conversations

REPO="slack-notifications-mcp"
PR_NUMBER=$1

if [ -z "$PR_NUMBER" ]; then
    echo "Usage: ./scripts/resolve-pr-conversations.sh <pr-number>"
    echo "Example: ./scripts/resolve-pr-conversations.sh 1"
    exit 1
fi

echo "Checking PR #$PR_NUMBER for unresolved conversations..."
echo ""

# Get unresolved threads
UNRESOLVED=$(gh api graphql -f query="
query {
  repository(owner: \"Stig-Johnny\", name: \"$REPO\") {
    pullRequest(number: $PR_NUMBER) {
      reviewThreads(first: 50) {
        nodes {
          id
          isResolved
          comments(first: 10) {
            nodes {
              author { login }
              body
              path
              line
            }
          }
        }
      }
    }
  }
}" --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)')

if [ -z "$UNRESOLVED" ]; then
    echo "No unresolved conversations found!"
    echo ""
    echo "Auto-merge should proceed automatically once all CI checks pass."
    exit 0
fi

# Parse unresolved threads
THREAD_IDS=$(echo "$UNRESOLVED" | jq -r '.id')
THREAD_COUNT=$(echo "$THREAD_IDS" | wc -l | tr -d ' ')

echo "Found $THREAD_COUNT unresolved conversation(s)"
echo ""

# Display each conversation
COUNTER=1
while IFS= read -r THREAD_ID; do
    echo ""
    echo "Conversation #$COUNTER (Thread ID: $THREAD_ID)"

    # Get conversation details
    DETAILS=$(echo "$UNRESOLVED" | jq -r "select(.id == \"$THREAD_ID\") | .comments.nodes[0]")

    AUTHOR=$(echo "$DETAILS" | jq -r '.author.login')
    FILE=$(echo "$DETAILS" | jq -r '.path')
    LINE=$(echo "$DETAILS" | jq -r '.line')
    BODY=$(echo "$DETAILS" | jq -r '.body')

    echo "   Author: $AUTHOR"
    echo "   File: $FILE:$LINE"
    echo ""
    echo "   Comment:"
    echo "$BODY" | sed 's/^/   | /'
    echo ""

    COUNTER=$((COUNTER + 1))
done <<< "$THREAD_IDS"

echo ""
echo "What would you like to do?"
echo ""
echo "1. Resolve all conversations (mark as acknowledged)"
echo "2. View PR to review manually"
echo "3. Exit (do nothing)"
echo ""
read -p "Enter choice (1-3): " CHOICE

case $CHOICE in
    1)
        echo ""
        echo "Resolving all conversations..."

        # Build mutation for all threads
        MUTATION="mutation {"
        COUNTER=1
        while IFS= read -r THREAD_ID; do
            MUTATION="$MUTATION
  thread$COUNTER: resolveReviewThread(input: {threadId: \"$THREAD_ID\"}) {
    thread { id isResolved }
  }"
            COUNTER=$((COUNTER + 1))
        done <<< "$THREAD_IDS"
        MUTATION="$MUTATION
}"

        # Execute mutation
        RESULT=$(gh api graphql -f query="$MUTATION")

        echo "All conversations resolved!"
        echo ""
        echo "Auto-merge will proceed automatically once CI checks pass."
        ;;
    2)
        echo ""
        echo "Opening PR in browser..."
        gh pr view $PR_NUMBER --web
        ;;
    3)
        echo ""
        echo "Exiting. Conversations remain unresolved."
        echo "Auto-merge will remain blocked until conversations are resolved."
        exit 1
        ;;
    *)
        echo ""
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
