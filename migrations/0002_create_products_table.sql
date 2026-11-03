
CREATE TABLE IF NOT EXISTS product_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    product_name TEXT NOT NULL,
    set_name TEXT,

    retailer TEXT NOT NULL
        CHECK (retailer IN (
            'Pokemon Center',
            'Best Buy',
            'GameStop',
            'Costco'
        )),

    msrp_cents INTEGER NOT NULL
        CHECK (msrp_cents >= 0),

    current_price_cents INTEGER
        CHECK (
            current_price_cents IS NULL
            OR current_price_cents >= 0
        ),

    product_url TEXT NOT NULL,

    stock_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (stock_status IN (
            'unknown',
            'in_stock',
            'out_of_stock'
        )),

    last_checked_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (retailer, product_url)
);

CREATE INDEX IF NOT EXISTS idx_products_name
ON product_listings(product_name);

CREATE INDEX IF NOT EXISTS idx_products_retailer
ON product_listings(retailer);

CREATE INDEX IF NOT EXISTS idx_products_stock
ON product_listings(stock_status);
