'use strict';

/**
 * Barber Shop - Interactive Application Logic
 * Navigation, Service Booking, Availability API, Newsletter & Toast Messaging
 */

/**
 * Helper: Add event on element or node list
 */
const addEventOnElem = function (elem, type, callback) {
  if (!elem) return;
  if (elem.length !== undefined && elem.length > 0) {
    for (let i = 0; i < elem.length; i++) {
      elem[i].addEventListener(type, callback);
    }
  } else {
    elem.addEventListener(type, callback);
  }
};

/**
 * Navbar Toggle & Mobile Menu Management
 */
const navbar = document.querySelector("[data-navbar]");
const navToggler = document.querySelector("[data-nav-toggler]");
const navLinks = document.querySelectorAll("[data-nav-link]");

const toggleNavbar = () => {
  if (navbar) navbar.classList.toggle("active");
};

if (navToggler) {
  addEventOnElem(navToggler, "click", toggleNavbar);
}

const closeNavbar = () => {
  if (navbar) navbar.classList.remove("active");
};

if (navLinks) {
  addEventOnElem(navLinks, "click", closeNavbar);
}

/**
 * Header & Back-to-Top Button Active on Scroll
 */
const header = document.querySelector("[data-header]");
const backTopBtn = document.querySelector("[data-back-top-btn]");

const headerActive = function () {
  if (!header || !backTopBtn) return;
  if (window.scrollY > 100) {
    header.classList.add("active");
    backTopBtn.classList.add("active");
  } else {
    header.classList.remove("active");
    backTopBtn.classList.remove("active");
  }
};

window.addEventListener("scroll", headerActive);

/**
 * Pricing Tab Filter Function
 */
const filterBtns = document.querySelectorAll("[data-filter-btn]");
const filterItems = document.querySelectorAll("[data-filter]");

if (filterBtns.length > 0) {
  let lastClickedFilterBtn = filterBtns[0];

  const filter = function () {
    if (lastClickedFilterBtn) lastClickedFilterBtn.classList.remove("active");
    this.classList.add("active");
    lastClickedFilterBtn = this;

    for (let i = 0; i < filterItems.length; i++) {
      if (
        this.dataset.filterBtn === filterItems[i].dataset.filter ||
        this.dataset.filterBtn === "all"
      ) {
        filterItems[i].style.display = "block";
        filterItems[i].classList.add("active");
      } else {
        filterItems[i].style.display = "none";
        filterItems[i].classList.remove("active");
      }
    }
  };

  addEventOnElem(filterBtns, "click", filter);
}

/**
 * Toast Notification System
 */
const toastContainer = document.getElementById("toast-container");

function showToast(title, message, type = "info", duration = 5000) {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let iconName = "information-circle-outline";
  if (type === "success") iconName = "checkmark-circle-outline";
  if (type === "error") iconName = "alert-circle-outline";

  toast.innerHTML = `
    <ion-icon name="${iconName}" class="toast-icon"></ion-icon>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
  `;

  toastContainer.appendChild(toast);

  // Trigger smooth entrance animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  const removeToast = () => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 350);
  };

  const closeBtn = toast.querySelector(".toast-close");
  if (closeBtn) closeBtn.addEventListener("click", removeToast);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

/**
 * Service Selection Helpers (From Cards or Links)
 */
const serviceLinks = document.querySelectorAll("[data-service-select]");
const serviceSelect = document.getElementById("appoin-service");
const appointmentSection = document.getElementById("appointment");

serviceLinks.forEach(link => {
  link.addEventListener("click", (e) => {
    const serviceName = link.getAttribute("data-service-select");
    if (serviceSelect && serviceName) {
      serviceSelect.value = serviceName;
      // Trigger change event to ensure any listener catches it
      serviceSelect.dispatchEvent(new Event("change"));
    }
    closeNavbar();
  });
});

/**
 * Appointment Date & Dynamic Availability Management
 */
const dateInput = document.getElementById("appoin-date");
const timeSelect = document.getElementById("appoin-time");
const appointmentForm = document.getElementById("appointment-form");
const appointmentFeedback = document.getElementById("appoin-feedback");
const appointmentSubmitBtn = document.getElementById("appoin-submit-btn");

// Set minimum date to today (YYYY-MM-DD)
if (dateInput) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const minDate = `${yyyy}-${mm}-${dd}`;
  dateInput.setAttribute("min", minDate);

  // If initial value is empty, set default to today
  if (!dateInput.value) {
    // If today is Saturday, default to tomorrow (Sunday)
    if (today.getDay() === 6) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomMm = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const tomDd = String(tomorrow.getDate()).padStart(2, "0");
      dateInput.value = `${tomorrow.getFullYear()}-${tomMm}-${tomDd}`;
    } else {
      dateInput.value = minDate;
    }
    // Load initial slots
    fetchAvailability(dateInput.value);
  }

  dateInput.addEventListener("change", () => {
    if (dateInput.value) {
      fetchAvailability(dateInput.value);
    }
  });
}

/**
 * Fetch available time slots from backend API
 */
async function fetchAvailability(selectedDate) {
  if (!timeSelect) return;

  timeSelect.innerHTML = `<option value="" disabled selected>Loading available times...</option>`;
  timeSelect.disabled = true;

  try {
    const res = await fetch(`/api/appointments/availability?date=${encodeURIComponent(selectedDate)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      timeSelect.innerHTML = `<option value="" disabled selected>${data.message || 'Error loading times'}</option>`;
      timeSelect.disabled = true;
      return;
    }

    if (data.isClosed) {
      timeSelect.innerHTML = `<option value="" disabled selected>Salon Closed on Saturdays</option>`;
      timeSelect.disabled = true;
      showToast("Salon Closed", data.message, "info", 5000);
      return;
    }

    if (!data.availableSlots || data.availableSlots.length === 0) {
      timeSelect.innerHTML = `<option value="" disabled selected>No slots remaining for this date</option>`;
      timeSelect.disabled = true;
      return;
    }

    timeSelect.innerHTML = `<option value="" disabled selected>Select Available Time (${data.availableSlots.length} open)</option>`;
    data.availableSlots.forEach(slot => {
      const opt = document.createElement("option");
      opt.value = slot;
      opt.textContent = slot;
      timeSelect.appendChild(opt);
    });

    timeSelect.disabled = false;
  } catch (err) {
    console.error("Availability fetch error:", err);
    timeSelect.innerHTML = `<option value="" disabled selected>Could not load slots (Server offline)</option>`;
    timeSelect.disabled = true;
  }
}

/**
 * Handle Appointment Form Submission
 */
if (appointmentForm) {
  appointmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("appoin-name");
    const emailInput = document.getElementById("appoin-email");
    const phoneInput = document.getElementById("appoin-phone");
    const messageInput = document.getElementById("appoin-message");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const service = serviceSelect ? serviceSelect.value : "";
    const date = dateInput ? dateInput.value : "";
    const time = timeSelect ? timeSelect.value : "";
    const notes = messageInput ? messageInput.value.trim() : "";

    // Clear previous feedback
    if (appointmentFeedback) {
      appointmentFeedback.className = "form-feedback";
      appointmentFeedback.style.display = "none";
      appointmentFeedback.textContent = "";
    }

    // Client-side validations
    if (name.length < 2) {
      showInlineFeedback("Please enter your full name (at least 2 characters).", "error");
      if (nameInput) nameInput.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showInlineFeedback("Please enter a valid email address.", "error");
      if (emailInput) emailInput.focus();
      return;
    }

    const phoneRegex = /^[\d\s()+-]{7,25}$/;
    if (!phoneRegex.test(phone)) {
      showInlineFeedback("Please enter a valid phone number.", "error");
      if (phoneInput) phoneInput.focus();
      return;
    }

    if (!service) {
      showInlineFeedback("Please select a salon service.", "error");
      if (serviceSelect) serviceSelect.focus();
      return;
    }

    if (!date) {
      showInlineFeedback("Please choose an appointment date.", "error");
      if (dateInput) dateInput.focus();
      return;
    }

    if (!time) {
      showInlineFeedback("Please choose an available appointment time slot.", "error");
      if (timeSelect) timeSelect.focus();
      return;
    }

    // Set loading state on button
    setButtonLoading(appointmentSubmitBtn, true, "Securing Appointment...");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          service,
          barber: "Master Barber",
          date,
          time,
          notes
        })
      });

      const result = await response.json();

      if (response.status === 201 && result.success) {
        const ref = result.appointment ? result.appointment.booking_reference : "";
        const successMsg = `Success! Appointment booked for ${service} on ${date} at ${time}. Your booking reference is ${ref}. Confirmation email has been sent.`;
        
        showInlineFeedback(successMsg, "success");
        showToast("Booking Confirmed!", `Reference #${ref}. See you on ${date} at ${time}!`, "success", 7000);

        // Reset form but re-fetch availability to eliminate booked slot
        appointmentForm.reset();
        if (dateInput) {
          dateInput.value = date;
          fetchAvailability(date);
        }
      } else if (response.status === 409 || result.conflict) {
        showInlineFeedback(result.message || "This time slot was just booked. Please pick another time.", "error");
        showToast("Slot Unavailable", "That time slot has just been taken. Please choose another slot.", "error", 6000);
        // Refresh availability slots for the date so user sees updated list
        fetchAvailability(date);
      } else {
        showInlineFeedback(result.message || "An error occurred while booking. Please try again.", "error");
        showToast("Booking Notice", result.message || "Could not complete booking.", "error", 6000);
      }
    } catch (err) {
      console.error("Booking submission error:", err);
      showInlineFeedback("Network communication error. Please verify your connection or try again shortly.", "error");
      showToast("Network Error", "Unable to communicate with the server. Please check your connection.", "error", 6000);
    } finally {
      setButtonLoading(appointmentSubmitBtn, false, "Appointment Now");
    }
  });
}

function showInlineFeedback(message, type) {
  if (!appointmentFeedback) return;
  appointmentFeedback.className = `form-feedback ${type}`;
  appointmentFeedback.textContent = message;
  appointmentFeedback.style.display = "flex";
  appointmentFeedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Handle Newsletter Subscription
 */
const newsletterForm = document.getElementById("newsletter-form");
const newsletterEmail = document.getElementById("newsletter-email");
const newsletterSubmitBtn = document.getElementById("newsletter-submit-btn");
const newsletterFeedback = document.getElementById("newsletter-feedback");

if (newsletterForm) {
  newsletterForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = newsletterEmail ? newsletterEmail.value.trim() : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setNewsletterFeedback("Please provide a valid email address.", "error");
      if (newsletterEmail) newsletterEmail.focus();
      return;
    }

    setButtonLoading(newsletterSubmitBtn, true, "Subscribing...");
    setNewsletterFeedback("", "none");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.duplicate) {
        setNewsletterFeedback(data.message, "duplicate");
        showToast("Newsletter", data.message, "info", 5000);
      } else if (data.success) {
        setNewsletterFeedback(data.message, "success");
        showToast("Subscribed!", data.message, "success", 5000);
        if (newsletterEmail) newsletterEmail.value = "";
      } else {
        setNewsletterFeedback(data.message || "Subscription failed.", "error");
        showToast("Subscription Error", data.message || "Failed to subscribe.", "error", 5000);
      }
    } catch (err) {
      console.error("Newsletter submission error:", err);
      setNewsletterFeedback("Network error. Please try again later.", "error");
      showToast("Network Error", "Unable to reach server.", "error", 5000);
    } finally {
      setButtonLoading(newsletterSubmitBtn, false, "Subscribe Now");
    }
  });
}

function setNewsletterFeedback(msg, type) {
  if (!newsletterFeedback) return;
  newsletterFeedback.className = `newsletter-feedback ${type}`;
  newsletterFeedback.textContent = msg;
}

/**
 * Helper: Toggle button loading state with spinner
 */
function setButtonLoading(button, isLoading, text) {
  if (!button) return;
  const btnText = button.querySelector(".btn-text");
  const spinner = button.querySelector(".spinner");
  const icon = button.querySelector(".btn-icon");

  button.disabled = isLoading;

  if (btnText) btnText.textContent = text;
  if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
  if (icon) icon.style.display = isLoading ? "none" : "inline-block";
}