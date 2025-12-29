
import * as React from 'react';

interface VerificationEmailProps {
    link: string;
}

export const VerificationEmail: React.FC<VerificationEmailProps> = ({ link }) => (
    <div
        style={{
            backgroundColor: '#f6f9fc',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
            padding: '40px 20px',
        }}
    >
        <div
            style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                margin: '0 auto',
                maxWidth: '580px',
                padding: '40px',
                border: '1px solid #e6ebf1',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
        >
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <img
                    src="https://res.cloudinary.com/dsjzapjbw/image/upload/v1766961633/CartSenseLogo_i9frog.png"
                    alt="CartSense"
                    width="48"
                    height="48"
                    style={{
                        margin: '0 auto',
                        display: 'block',
                    }}
                />
            </div>

            {/* Main Content */}
            <h1
                style={{
                    color: '#1a1a1a',
                    fontSize: '24px',
                    fontWeight: '600',
                    lineHeight: '1.3',
                    margin: '0 0 24px',
                    textAlign: 'center',
                }}
            >
                Verify your email address
            </h1>

            <p
                style={{
                    color: '#4c4c4c',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    margin: '0 0 32px',
                    textAlign: 'center',
                }}
            >
                Welcome to CartSense! We're excited to help you plan effortless meals. Please verify your email address to secure your account and get started.
            </p>

            {/* CTA Button */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <a
                    href={link}
                    style={{
                        backgroundColor: '#4A90E2',
                        borderRadius: '12px',
                        color: '#ffffff',
                        display: 'inline-block',
                        fontSize: '16px',
                        fontWeight: '600',
                        lineHeight: '50px',
                        textDecoration: 'none',
                        textAlign: 'center',
                        width: '100%',
                        maxWidth: '240px',
                        boxShadow: '0 4px 6px rgba(74, 144, 226, 0.2)',
                    }}
                >
                    Verify Email
                </a>
            </div>

            {/* Divider */}
            <hr
                style={{
                    border: 'none',
                    borderTop: '1px solid #e6ebf1',
                    margin: '32px 0',
                }}
            />

            {/* Footer */}
            <p
                style={{
                    color: '#8c8c8c',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    margin: '0',
                    textAlign: 'center',
                }}
            >
                If you didn't create an account with CartSense, you can safely ignore this email.
            </p>

            <p
                style={{
                    color: '#b3b3b3',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    marginTop: '24px',
                    textAlign: 'center',
                }}
            >
                © {new Date().getFullYear()} CartSense. All rights reserved.
            </p>
        </div>
    </div>
);

export default VerificationEmail;
