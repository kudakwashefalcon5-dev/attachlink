window.AttachLinkCompanyLogo = (container, companyId) => {
    if (!container || !/^\d+$/.test(String(companyId))) return;
    const image = document.createElement('img');
    image.alt = '';
    image.className = 'w-full h-full rounded-xl object-contain';
    image.onload = () => container.replaceChildren(image);
    image.src = '../../backend/api/student/company-logo.php?company_id='+encodeURIComponent(companyId);
};
