async function sellBackToAdmin(card) {
  try {
    const { data: { user } } =
      await window.supabaseClient.auth.getUser();

    if (!user) {
      alert("Please login first");
      return;
    }

    const { error } = await window.supabaseClient
      .from("sell_back_requests")
      .insert({
        card_id: card.id,
        seller_id: user.id,
        card_name: card.name,
        amount: card.price,
        status: "pending"
      });

    if (error) throw error;

    alert("Sell back request submitted to Admin Hub");

  } catch (err) {
    console.error(err);
    alert("Error submitting sell back: " + err.message);
  }
}