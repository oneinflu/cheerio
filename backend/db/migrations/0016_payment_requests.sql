BEGIN;

CREATE TABLE payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    request_type TEXT NOT NULL, -- 'course' or 'webinar'
    details JSONB NOT NULL DEFAULT '{}'::jsonb, -- course name, papers, etc.
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'expired'
    external_reference TEXT, -- Stripe/Razorpay link ID or similar
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_requests_contact ON payment_requests(contact_id);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);

COMMIT;
