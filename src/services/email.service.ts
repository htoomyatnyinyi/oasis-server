import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify Your Email Address",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Our E-commerce Store!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verificationUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #3498db; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset Your Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <a href="${resetUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #e74c3c; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// export const sendOrderConfirmationEmail = async (email: string, order: any) => {
//   const mailOptions = {
//     from: process.env.EMAIL_FROM,
//     to: email,
//     subject: `Order Confirmation - #${order.id}`,
//     html: `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2>Thank you for your order!</h2>
//         <p>Your order has been confirmed and is being processed.</p>

//         <h3>Order Details</h3>
//         <p><strong>Order ID:</strong> ${order.id}</p>
//         <p><strong>Order Date:</strong> ${new Date(
//           order.createdAt
//         ).toLocaleDateString()}</p>
//         <p><strong>Total Amount:</strong> $${order.totalAmount}</p>

//         <h3>Shipping Address</h3>
//         <p>${order.shippingAddress.street}<br>
//            ${order.shippingAddress.city}, ${order.shippingAddress.state}<br>
//            ${order.shippingAddress.country} ${
//       order.shippingAddress.postalCode
//     }</p>

//         <p>You can track your order in your account dashboard.</p>
//         <p>Thank you for shopping with us!</p>
//       </div>
//     `,
//   };

//   await transporter.sendMail(mailOptions);
// };

// Add to existing email.service.ts

export const sendOrderConfirmationEmail = async (
  email: string,
  order: any,
  user: any
) => {
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const itemsHtml = order.items
    .map(
      (item: any) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <strong>${item.productName}</strong><br>
        Quantity: ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        $${Number(item.price).toFixed(2)}
      </td>
    </tr>
  `
    )
    .join("");

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Order Confirmation - #${order.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Thank you for your order, ${
          user.firstName
        }!</h2>
        <p>Your order has been confirmed and is being processed.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Details</h3>
          <p><strong>Order Number:</strong> ${order.id}</p>
          <p><strong>Order Date:</strong> ${orderDate}</p>
          <p><strong>Order Status:</strong> ${order.status}</p>
          <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
          
          <h4>Items Ordered</h4>
          <table style="width: 100%; border-collapse: collapse;">
            ${itemsHtml}
          </table>
          
          <div style="margin-top: 20px; border-top: 2px solid #ddd; padding-top: 20px;">
            <table style="width: 100%;">
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">$${Number(
                  order.subtotal
                ).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Shipping:</td>
                <td style="text-align: right;">$${Number(
                  order.shippingAmount
                ).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Tax:</td>
                <td style="text-align: right;">$${Number(
                  order.taxAmount
                ).toFixed(2)}</td>
              </tr>
              ${
                order.discountAmount > 0
                  ? `
              <tr>
                <td>Discount:</td>
                <td style="text-align: right; color: #2ecc71;">-$${Number(
                  order.discountAmount
                ).toFixed(2)}</td>
              </tr>
              `
                  : ""
              }
              <tr style="font-weight: bold; font-size: 1.1em;">
                <td>Total:</td>
                <td style="text-align: right;">$${Number(
                  order.totalAmount
                ).toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div style="background: #e8f4fc; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Shipping Information</h3>
          <p>
            ${order.shippingAddress.street}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state}<br>
            ${order.shippingAddress.country} ${order.shippingAddress.postalCode}
          </p>
          ${
            order.estimatedDelivery
              ? `
          <p><strong>Estimated Delivery:</strong> ${new Date(
            order.estimatedDelivery
          ).toLocaleDateString()}</p>
          `
              : ""
          }
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p>You can track your order in your account dashboard.</p>
          <a href="${process.env.CLIENT_URL}/orders/${order.id}" 
             style="display: inline-block; padding: 12px 24px; background-color: #3498db; 
                    color: white; text-decoration: none; border-radius: 4px; margin: 10px;">
            View Order Status
          </a>
        </div>
        
        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendOrderShippedEmail = async (
  email: string,
  order: any,
  trackingNumber: string
) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Your Order Has Shipped - #${order.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Good news! Your order has shipped!</h2>
        <p>Order #${order.id} is on its way to you.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Tracking Information</h3>
          <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
          <p><strong>Shipping Method:</strong> ${order.shippingMethod}</p>
          
          <a href="https://www.ups.com/track?tracknum=${trackingNumber}" 
             style="display: inline-block; padding: 12px 24px; background-color: #2ecc71; 
                    color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
            Track Your Package
          </a>
        </div>
        
        <p>Thank you for shopping with us!</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendPaymentFailedEmail = async (
  email: string,
  order: any,
  error: string
) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Payment Failed - Order #${order.id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #e74c3c;">Payment Failed</h2>
        <p>We were unable to process your payment for Order #${order.id}.</p>
        
        <div style="background: #fdf2f2; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #f5c6cb;">
          <p><strong>Reason:</strong> ${error}</p>
          <p><strong>Order Total:</strong> $${Number(order.totalAmount).toFixed(
            2
          )}</p>
        </div>
        
        <p>Please update your payment information to complete your order:</p>
        <a href="${process.env.CLIENT_URL}/checkout/payment/${order.id}" 
           style="display: inline-block; padding: 12px 24px; background-color: #3498db; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 10px;">
          Update Payment
        </a>
        
        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
          Your order will be cancelled if payment is not completed within 24 hours.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
