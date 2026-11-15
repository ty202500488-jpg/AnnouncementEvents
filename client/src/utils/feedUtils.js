/**
 * Fisher-Yates shuffle returning a new array with randomized item order.
 */
export function shuffleFeedItems(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function hidePostOnServer(postId, token, reason = null) {
  if (!postId || !token) return;
  try {
    await fetch(`http://localhost:5000/users/posts/${postId}/hide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(reason ? { reason } : {}),
    });
  } catch (err) {
    console.error('Failed to persist hidden post:', err);
  }
}

export async function unhidePostOnServer(postId, token) {
  if (!postId || !token) return;
  try {
    await fetch(`http://localhost:5000/users/posts/${postId}/hide`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error('Failed to unhide post:', err);
  }
}

export async function hideAllFromPageOnServer(pageId, token) {
  if (!pageId || !token) return;
  try {
    await fetch(`http://localhost:5000/users/pages/${pageId}/hide-all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error('Failed to hide posts from page:', err);
  }
}
