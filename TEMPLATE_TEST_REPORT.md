# WhatsApp Template Test Report

**Date:** 2026-02-27T05:44:28.614Z

**Total Tests:** 10
**Success:** 6
**Failed:** 4
**Skipped:** 0

## Results

| Name | Category | Status | Error | Details |
|---|---|---|---|---|
| mkt_text_qr_1772171023571 | MARKETING | SUCCESS | - | Header: TEXT, BODY, FOOTER, Buttons: 2 |
| mkt_img_cta_1772171023571 | MARKETING | FAILED | {"message":"(#192) Param components[2]['buttons'][1]['phone_number'] is not a valid phone number.","type":"OAuthException","code":192,"fbtrace_id":"ADd4D4Jhi66fFzmy5ofqUaw"} | Header: IMAGE, BODY, Buttons: 2 |
| mkt_vid_footer_1772171023571 | MARKETING | SUCCESS | - | Header: VIDEO, BODY, FOOTER, Buttons: 1 |
| mkt_doc_no_btn_1772171023571 | MARKETING | SUCCESS | - | Header: DOCUMENT, BODY, FOOTER |
| mkt_coupon_1772171023571 | MARKETING | FAILED | {"message":"Invalid parameter","type":"OAuthException","code":100,"error_subcode":2388299,"is_transient":false,"error_user_title":"Leading or trailing params not allowed","error_user_msg":"Variables can't be at the start or end of the template.","fbtrace_id":"Alt30a2MTuFbl6IhgAwCUSl"} | BODY, Buttons: 1 |
| mkt_limited_offer_1772171023571 | MARKETING | SUCCESS | - | Header: TEXT, BODY, FOOTER, Buttons: 1 |
| util_order_update_1772171023571 | UTILITY | SUCCESS | - | Header: TEXT, BODY, FOOTER |
| util_receipt_1772171023571 | UTILITY | FAILED | {"message":"Invalid parameter","type":"OAuthException","code":100,"error_subcode":2388299,"is_transient":false,"error_user_title":"Leading or trailing params not allowed","error_user_msg":"Variables can't be at the start or end of the template.","fbtrace_id":"AsJ0xxLJu--gIjt-VGti6q2"} | Header: DOCUMENT, BODY |
| util_account_alert_1772171023571 | UTILITY | SUCCESS | - | BODY, Buttons: 2 |
| auth_code_1772171023571 | AUTHENTICATION | FAILED | {"message":"Invalid parameter","type":"OAuthException","code":100,"error_subcode":2388042,"is_transient":false,"error_user_title":"Message template \"components\" param contains unexpected field(s)","error_user_msg":"component of type BODY has unexpected field(s) (text)","fbtrace_id":"A3FCNCyYwgUVdZVFNBo7EDW"} | BODY, FOOTER, Buttons: 1 |

## Explanations & Rules

### 1. Marketing Templates
- Used for promotions, offers, updates, or invitations.
- Can have Headers (Text/Media), Footers, and Buttons (QR, CTA, Copy Code).
- **Rule:** If using variables in Body, must provide examples.
- **Rule:** Copy Code button is only allowed for Marketing (Coupon) and Authentication.

### 2. Utility Templates
- Used for post-purchase updates, billing, account alerts.
- **Rule:** Cannot contain promotional content.
- **Rule:** Variables must be specific (e.g., order ID).

### 3. Authentication Templates
- Used for OTPs.
- **Rule:** Extremely strict structure. Often "COPY_CODE" or "ONE_TAP" button required.
- **Rule:** Body text is fixed for the most part (e.g., "Your verification code is {{1}}").
- **Rule:** Security recommendation toggle (`add_security_recommendation: true`) is often required.
