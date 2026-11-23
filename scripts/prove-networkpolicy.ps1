Write-Host "=== TEST 1: Direct wget from busybox to ticket-service (MUST FAIL) ==="
kubectl run netpol-fail --rm -i --restart=Never --image=busybox -n supportpilot -- wget -T 3 -O- http://ticket-service:4001/health 2>&1
Write-Host "=== TEST 2: wget from gateway deployment to ticket-service (MUST SUCCEED) ==="
kubectl exec -n supportpilot deployment/gateway -- wget -q -O- http://ticket-service:4001/health
Write-Host ""
Write-Host "=== TEST 3: wget from busybox with app=gateway label to ticket-service (MUST SUCCEED) ==="
kubectl run netpol-pass --rm -i --restart=Never --image=busybox --labels="app=gateway" -n supportpilot -- wget -q -O- http://ticket-service:4001/health 2>&1
