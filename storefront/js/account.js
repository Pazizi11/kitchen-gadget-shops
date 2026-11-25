function accountMessage(text,error){
  const el=document.getElementById('accountMessage');
  if(!el)return;
  el.hidden=false;
  el.className='account-message '+(error?'error':'success');
  el.textContent=text;
}

function formatTrackerStatus(value){
  if(!value)return 'Pending';
  return String(value)
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\b\w/g,function(c){return c.toUpperCase();});
}

function getOrderTracking(order){
  const metadata=order && order.metadata ? order.metadata : {};

  return {
    cjOrderId:metadata.cj_order_id || '',
    cjOrderNumber:metadata.cj_order_number || '',
    cjStatus:metadata.cj_order_status || '',
    trackingNumber:metadata.cj_tracking_number || '',
    trackingUrl:metadata.cj_tracking_url || '',
    trackingProvider:metadata.cj_tracking_provider || '',
    logisticName:metadata.cj_logistic_name || '',
    lastWebhookAt:metadata.cj_last_webhook_at || ''
  };
}

function renderOrderTracker(order,index){
  const tracking=getOrderTracking(order);
  const orderNumber=order.display_id || order.id || '';
  const panelId='order-tracker-'+index;

  const hasTracking=!!tracking.trackingNumber;
  const provider=tracking.trackingProvider || tracking.logisticName;

  let trackingContent='';

  if(hasTracking){
    trackingContent=
      '<div class="order-tracker-status">'+
        '<strong>Shipment tracking available</strong>'+
        '<span>Your package has been assigned a tracking number.</span>'+
      '</div>'+
      '<div class="order-tracker-details">'+
        '<div><span class="account-muted">Carrier</span><strong>'+escapeHtml(provider || 'Carrier information pending')+'</strong></div>'+
        '<div><span class="account-muted">Tracking number</span><strong>'+escapeHtml(tracking.trackingNumber)+'</strong></div>'+
        (tracking.cjStatus?
          '<div><span class="account-muted">Shipping status</span><strong>'+escapeHtml(formatTrackerStatus(tracking.cjStatus))+'</strong></div>'
          :'')+
      '</div>'+
      (tracking.trackingUrl?
        '<a class="btn btn-primary btn-sm order-tracker-link" href="'+escapeHtml(tracking.trackingUrl)+'" target="_blank" rel="noopener noreferrer">Track Package</a>'
        :
        '<p class="account-muted order-tracker-note">Your tracking number is available. The carrier tracking link has not been provided yet.</p>'
      );
  }else{
    trackingContent=
      '<div class="order-tracker-pending">'+
        '<strong>Tracking information pending</strong>'+
        '<span>Your order is being prepared. Tracking information will appear here once your shipment is dispatched.</span>'+
      '</div>';
  }

  const lastUpdate=tracking.lastWebhookAt
    ? '<p class="account-muted order-tracker-updated">Last tracking update: '+escapeHtml(new Date(tracking.lastWebhookAt).toLocaleString())+'</p>'
    : '';

  return (
    '<div class="order-tracker" id="'+panelId+'" hidden>'+
      '<div class="order-tracker-header">'+
        '<div>'+
          '<h3>Order Tracking</h3>'+
          '<p class="account-muted">Order #'+escapeHtml(orderNumber)+'</p>'+
        '</div>'+
        '<div class="order-tracker-order-status">'+
          '<span>Order status</span>'+
          '<strong>'+escapeHtml(formatTrackerStatus(order.status || 'Processing'))+'</strong>'+
        '</div>'+
      '</div>'+
      '<div class="order-tracker-body">'+
        trackingContent+
        lastUpdate+
      '</div>'+
    '</div>'
  );
}

function bindOrderTrackerButtons(){
  document.querySelectorAll('.order-tracker-toggle').forEach(function(button){
    button.addEventListener('click',function(){
      const panelId=button.getAttribute('data-tracker-target');
      const panel=document.getElementById(panelId);
      if(!panel)return;

      const isHidden=panel.hidden;
      panel.hidden=!isHidden;

      button.textContent=isHidden?'Hide Tracking':'Track Order';
      button.setAttribute('aria-expanded',isHidden?'true':'false');
    });
  });
}

function renderAccount(customer,orders){
  const root=document.getElementById('accountRoot');
  const name=customerDisplayName(customer);

  const rows=(orders||[]).map(function(o,index){
    const orderNumber=o.display_id||o.id||'';
    const trackerId='order-tracker-'+index;

    return (
      '<tr>'+
        '<td><strong>'+escapeHtml(orderNumber)+'</strong></td>'+
        '<td>'+new Date(o.created_at||Date.now()).toLocaleDateString()+'</td>'+
        '<td>'+escapeHtml(formatTrackerStatus(o.status||''))+'</td>'+
        '<td>'+formatMoney((o.total||0))+'</td>'+
        '<td>'+
          '<button type="button" class="btn btn-outline btn-sm order-tracker-toggle" data-tracker-target="'+trackerId+'" aria-expanded="false">Track Order</button>'+
        '</td>'+
      '</tr>'+
      '<tr class="order-tracker-row">'+
        '<td colspan="5">'+renderOrderTracker(o,index)+'</td>'+
      '</tr>'
    );
  }).join('');

  root.innerHTML=
    '<div class="account-heading">'+
      '<div>'+
        '<h1>My Account</h1>'+
        '<p class="account-muted">Welcome, '+escapeHtml(name)+'.</p>'+
      '</div>'+
      '<button class="btn btn-outline btn-sm" id="logoutBtn">Log Out</button>'+
    '</div>'+
    '<div id="accountMessage" class="account-message" hidden></div>'+
    '<div class="account-grid">'+
      '<section class="account-card">'+
        '<h2>Profile</h2>'+
        '<form id="profileForm">'+
          '<div class="form-row">'+
            '<div class="form-group">'+
              '<label>First name</label>'+
              '<input id="profileFirst" value="'+escapeHtml(customer.first_name||'')+'" required>'+
            '</div>'+
            '<div class="form-group">'+
              '<label>Last name</label>'+
              '<input id="profileLast" value="'+escapeHtml(customer.last_name||'')+'" required>'+
            '</div>'+
          '</div>'+
          '<div class="form-group">'+
            '<label>Email</label>'+
            '<input value="'+escapeHtml(customer.email||'')+'" disabled>'+
          '</div>'+
          '<div class="form-group">'+
            '<label>Phone</label>'+
            '<input id="profilePhone" value="'+escapeHtml(customer.phone||'')+'">'+
          '</div>'+
          '<button class="btn btn-primary" id="saveProfile">Save Changes</button>'+
        '</form>'+
        '<div class="account-links">'+
          '<a href="forgot-password.html">Change password</a>'+
        '</div>'+
      '</section>'+
      '<section class="account-card">'+
        '<h2>Order History</h2>'+
        (
          rows
          ?
          '<div class="account-table-wrap">'+
            '<table class="account-table">'+
              '<thead>'+
                '<tr>'+
                  '<th>Order</th>'+
                  '<th>Date</th>'+
                  '<th>Status</th>'+
                  '<th>Total</th>'+
                  '<th>Tracking</th>'+
                '</tr>'+
              '</thead>'+
              '<tbody>'+rows+'</tbody>'+
            '</table>'+
          '</div>'
          :
          '<p class="account-muted">You have no orders yet.</p>'+
          '<a href="products.html" class="btn btn-primary btn-sm">Start Shopping</a>'
        )+
      '</section>'+
    '</div>';

  document.getElementById('logoutBtn').addEventListener('click',async function(){
    await logoutCustomer();
    location.href='index.html';
  });

  document.getElementById('profileForm').addEventListener('submit',async function(e){
    e.preventDefault();

    const b=document.getElementById('saveProfile');
    b.disabled=true;
    b.textContent='Saving...';

    try{
      const updated=await updateCurrentCustomer({
        first_name:document.getElementById('profileFirst').value.trim(),
        last_name:document.getElementById('profileLast').value.trim(),
        phone:document.getElementById('profilePhone').value.trim()
      });

      renderAccount(updated,orders);
      accountMessage('Profile updated.');
    }catch(err){
      accountMessage(err.message||'Could not update profile.',true);
      b.disabled=false;
      b.textContent='Save Changes';
    }
  });

  bindOrderTrackerButtons();
}

document.addEventListener('DOMContentLoaded',async function(){
  if(!isCustomerLoggedIn()){
    location.href='login.html?next=account.html';
    return;
  }

  try{
    const customer=await refreshCurrentCustomer();
    const orders=await getCustomerOrders();
    renderAccount(customer,orders);
  }catch(err){
    clearCustomerAuth();
    location.href='login.html?next=account.html';
  }
});
