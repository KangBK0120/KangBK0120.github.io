export function groupPostsByYear(posts) {
    const grouped = posts.reduce((groups, post) => {
        const year = new Date(post.frontmatter.pubDate).getFullYear();
        if (!groups[year]) {
            groups[year] = [];
        }
        groups[year].push(post);
        return groups;
    }, {});

    // 각 그룹 내에서 최신 순으로 정렬
    for (const year in grouped) {
        grouped[year].sort((a, b) => new Date(b.frontmatter.pubDate) - new Date(a.frontmatter.pubDate));
    }

    return grouped;
}