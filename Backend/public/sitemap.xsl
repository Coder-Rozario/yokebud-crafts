<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
	<xsl:key name="category" match="sitemap:url" use="sitemap:category" />
	<xsl:template match="/">
		<html xmlns="http://www.w3.org/1999/xhtml">
			<head>
				<title>XML Sitemap - Yokebud Crafts</title>
				<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
				<style type="text/css">
					body {
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
						color: #eee;
						background-color: #050505;
						margin: 0;
						padding: 40px 20px;
					}
					a {
						color: #F59E0B;
						text-decoration: none;
						transition: all 0.2s;
					}
					a:hover {
						color: #FBBF24;
						text-decoration: underline;
					}
					.container {
						max-width: 1000px;
						margin: 0 auto;
						background: #111;
						padding: 40px;
						border-radius: 24px;
						border: 1px solid rgba(255, 255, 255, 0.1);
						box-shadow: 0 20px 50px rgba(0,0,0,0.5);
					}
					.header {
						margin-bottom: 40px;
						border-bottom: 1px solid rgba(255,255,255,0.1);
						padding-bottom: 20px;
					}
					h1 {
						margin: 0;
						font-size: 2.5rem;
						font-weight: 800;
						background: linear-gradient(to right, #F59E0B, #FBBF24);
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
					}
					p.description {
						color: #a1a1aa;
						margin-top: 10px;
					}
					table {
						width: 100%;
						border-collapse: collapse;
						margin-top: 20px;
					}
					th {
						text-align: left;
						padding: 12px 15px;
						border-bottom: 2px solid rgba(255,255,255,0.1);
						color: #a1a1aa;
						text-transform: uppercase;
						font-size: 0.8rem;
						letter-spacing: 0.05em;
					}
					tr:hover {
						background: rgba(255,255,255,0.03);
					}
					td {
						padding: 15px;
						border-bottom: 1px solid rgba(255,255,255,0.05);
						font-size: 0.95rem;
					}
					.priority-badge {
						display: inline-block;
						padding: 3px 8px;
						border-radius: 6px;
						font-size: 0.8rem;
						font-weight: 700;
						background: rgba(245, 158, 11, 0.1);
						color: #F59E0B;
					}
					.lastmod {
						color: #71717a;
						font-size: 0.85rem;
					}
					.category-group {
						margin-bottom: 40px;
					}
					.category-header {
						background: linear-gradient(to right, #1e1e1e, #111);
						padding: 15px 20px;
						margin-top: 30px;
						border-radius: 12px 12px 0 0;
						color: #F59E0B;
						font-weight: 800;
						font-size: 1.2rem;
						border-bottom: 2px solid #F59E0B;
						display: flex;
						justify-content: space-between;
						align-items: center;
					}
					.category-count {
						font-size: 0.8rem;
						background: rgba(245, 158, 11, 0.1);
						padding: 4px 10px;
						border-radius: 20px;
						color: #F59E0B;
					}
					.image-count {
						color: #10b981;
						font-weight: 600;
					}
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>XML Sitemap</h1>
						<xsl:choose>
							<!-- URLSET: detailed URL listing (pages, products, blogs, etc.) -->
							<xsl:when test="sitemap:urlset">
								<p class="description">
									Yokebud Crafts - Sitemap with Hierarchical Grouping
								</p>
								<p class="description">
									Total Sections: <xsl:value-of select="count(sitemap:urlset/sitemap:url[generate-id() = generate-id(key('category', sitemap:category)[1])])"/> | 
									Total URLs: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/>
								</p>
							</xsl:when>

							<!-- SITEMAP INDEX: list child sitemap.xml files -->
							<xsl:when test="sitemap:sitemapindex">
								<p class="description">
									Yokebud Crafts - Sitemap Index
								</p>
								<p class="description">
									Total Sitemaps: <xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)"/>
								</p>
							</xsl:when>
						</xsl:choose>
					</div>

					<!-- When this document is a regular URLSET sitemap -->
					<xsl:if test="sitemap:urlset">
						<xsl:for-each select="sitemap:urlset/sitemap:url[generate-id() = generate-id(key('category', sitemap:category)[1])]">
							<xsl:sort select="sitemap:category" order="ascending"/>
							<xsl:variable name="catName" select="sitemap:category" />
							
							<div class="category-group">
								<div class="category-header">
									<span><xsl:value-of select="$catName" /></span>
									<span class="category-count"><xsl:value-of select="count(key('category', $catName))" /> Items</span>
								</div>
								<table>
									<thead>
										<tr>
											<th style="width: 60%">URL</th>
											<th style="width: 10%">Priority</th>
											<th style="width: 15%">Change Freq</th>
											<th style="width: 15%">Last Mod</th>
										</tr>
									</thead>
									<tbody>
										<xsl:for-each select="key('category', $catName)">
											<xsl:sort select="sitemap:priority" order="descending" />
											<tr>
												<td>
													<a href="{sitemap:loc}">
														<xsl:value-of select="sitemap:loc"/>
													</a>
													<xsl:if test="count(image:image) > 0">
														<br/><span class="image-count">
															<xsl:value-of select="count(image:image)"/> Images
														</span>
													</xsl:if>
												</td>
												<td>
													<span class="priority-badge">
														<xsl:value-of select="sitemap:priority"/>
													</span>
												</td>
												<td>
													<xsl:value-of select="sitemap:changefreq"/>
												</td>
												<td class="lastmod">
													<xsl:value-of select="sitemap:lastmod"/>
												</td>
											</tr>
										</xsl:for-each>
									</tbody>
								</table>
							</div>
						</xsl:for-each>
					</xsl:if>

					<!-- When this document is the sitemap INDEX (sitemapindex root) -->
					<xsl:if test="sitemap:sitemapindex">
						<div class="category-group">
							<div class="category-header">
								<span>Sitemaps</span>
								<span class="category-count">
									<xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)"/> Files
								</span>
							</div>
							<table>
								<thead>
									<tr>
										<th style="width: 65%">Sitemap URL</th>
										<th style="width: 35%">Last Mod</th>
									</tr>
								</thead>
								<tbody>
									<xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
										<tr>
											<td>
												<a href="{sitemap:loc}">
													<xsl:value-of select="sitemap:loc"/>
												</a>
											</td>
											<td class="lastmod">
												<xsl:value-of select="sitemap:lastmod"/>
											</td>
										</tr>
									</xsl:for-each>
								</tbody>
							</table>
						</div>
					</xsl:if>
				</div>
			</body>
		</html>
	</xsl:template>
</xsl:stylesheet>
